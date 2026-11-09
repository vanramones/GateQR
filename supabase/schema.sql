-- ============================================================================
-- GateQR: Vehicle Pass Registration System
-- Supabase schema: tables, RLS policies, triggers, and storage bucket.
-- Run this once in: Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- Enum types ----------
do $$ begin
  create type user_role as enum ('admin', 'guard', 'student', 'faculty', 'staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type pass_status as enum ('active', 'revoked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gate_action as enum ('entry', 'exit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gate_result as enum ('granted', 'denied');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- Tables
-- ============================================================================

-- One row per auth.users account, extended with GateQR profile fields.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  role user_role not null default 'student',
  id_number text default '',
  department text default '',
  phone text default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_id_number_unique on public.profiles (id_number) where id_number <> '';

-- Single-row system configuration, managed by admins.
create table if not exists public.settings (
  id int primary key default 1,
  campus_name text not null default 'Northwest Samar State University',
  gate_name text not null default 'Main Gate',
  default_validity_months int not null default 12,
  expiry_reminder_days int not null default 30,
  default_visitor_hours int not null default 4,
  max_visitor_hours int not null default 24,
  require_license_check boolean not null default true,
  max_vehicle_slots int not null default 300,
  constraint settings_singleton check (id = 1)
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  plate text not null,
  make text not null,
  model text not null,
  color text not null,
  year text not null,
  orcr_no text not null,
  license_no text not null,
  license_expiry date not null,
  id_front_path text,
  id_back_path text,
  selfie_path text,
  vehicle_photo_path text,
  vehicle_front_path text,
  vehicle_side_path text,
  vehicle_back_path text,
  proof_doc_path text,
  payment_notice_sent_at timestamptz,
  payment_receipt_path text,
  status vehicle_status not null default 'pending',
  remarks text not null default '',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  valid_until timestamptz
);
-- Safe to re-run: adds the columns for databases created before they existed.
alter table public.vehicles add column if not exists proof_doc_path text;
alter table public.vehicles add column if not exists selfie_path text;
alter table public.vehicles add column if not exists vehicle_photo_path text;
alter table public.vehicles add column if not exists vehicle_front_path text;
alter table public.vehicles add column if not exists vehicle_side_path text;
alter table public.vehicles add column if not exists vehicle_back_path text;
alter table public.vehicles add column if not exists payment_notice_sent_at timestamptz;
alter table public.vehicles add column if not exists payment_receipt_path text;
alter table public.vehicles add column if not exists pass_enabled boolean not null default true;
alter table public.vehicles add column if not exists access_start time;
alter table public.vehicles add column if not exists access_end time;
alter table public.profiles add column if not exists pass_enabled boolean not null default true;

create index if not exists vehicles_user_id_idx on public.vehicles (user_id);
create index if not exists vehicles_plate_idx on public.vehicles (plate);
create index if not exists vehicles_status_idx on public.vehicles (status);
-- A plate can only have one active (pending/approved) registration at a time.
-- Rejected records are excluded so owners can re-submit after a rejection.
create unique index if not exists vehicles_plate_active_unique on public.vehicles (plate) where status <> 'rejected';

create table if not exists public.visitor_passes (
  id uuid primary key default gen_random_uuid(),
  visitor_name text not null,
  plate text not null,
  vehicle_type text not null,
  purpose text not null,
  host text not null,
  contact text not null,
  issued_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  valid_until timestamptz not null,
  status pass_status not null default 'active'
);

create table if not exists public.gate_logs (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  type text not null,
  ref_id text,
  plate text,
  name text,
  action gate_action not null,
  result gate_result not null,
  reason text not null default '',
  guard_id uuid references public.profiles (id) on delete set null,
  "timestamp" timestamptz not null default now()
);
create index if not exists gate_logs_ref_id_idx on public.gate_logs (ref_id);
create index if not exists gate_logs_timestamp_idx on public.gate_logs ("timestamp" desc);

-- In-app notifications: staff write them, owners read their own.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_id_idx on public.notifications (user_id);

-- ============================================================================
-- Helper functions (SECURITY DEFINER avoids RLS recursion on profiles)
-- ============================================================================

create or replace function public.current_role()
returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'guard') from public.profiles where id = auth.uid()), false);
$$;

-- Auto-create a profile row whenever a new auth user signs up.
-- IMPORTANT: self-signup can only ever result in student/faculty/staff.
-- Admin/guard accounts are granted only via a redeemed staff invite (see below),
-- never by trusting client-supplied metadata directly.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  safe_role user_role;
begin
  safe_role := case when requested_role in ('student', 'faculty', 'staff') then requested_role::user_role else 'student' end;
  insert into public.profiles (id, name, email, role, id_number, department, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    safe_role,
    coalesce(new.raw_user_meta_data->>'id_number', ''),
    coalesce(new.raw_user_meta_data->>'department', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Staff invites: lets an admin grant 'admin' or 'guard' role to a new signup
-- WITHOUT ever needing the service_role (secret) key in the frontend.
-- Flow: admin generates a one-time code -> new user signs up via the Staff
-- Sign-up page with that code -> redeem_staff_invite() upgrades their role.
-- ----------------------------------------------------------------------------
create table if not exists public.staff_invites (
  code text primary key,
  role user_role not null check (role in ('admin', 'guard')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  redeemed_by uuid references public.profiles (id) on delete set null,
  redeemed_at timestamptz
);

alter table public.staff_invites enable row level security;

drop policy if exists "staff_invites_admin_manage" on public.staff_invites;
create policy "staff_invites_admin_manage" on public.staff_invites for all
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.redeem_staff_invite(invite_code text)
returns user_role
language plpgsql security definer set search_path = public as $$
declare
  inv public.staff_invites;
begin
  select * into inv from public.staff_invites where code = invite_code and redeemed_by is null;
  if not found then
    raise exception 'Invalid or already used invite code.';
  end if;
  perform set_config('gateqr.allow_role_change', 'on', true);
  update public.profiles set role = inv.role where id = auth.uid();
  update public.staff_invites set redeemed_by = auth.uid(), redeemed_at = now() where code = invite_code;
  return inv.role;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.vehicles enable row level security;
alter table public.visitor_passes enable row level security;
alter table public.gate_logs enable row level security;
alter table public.notifications enable row level security;

-- Block privilege escalation: a client-authenticated update on profiles may not
-- touch role / active / id_number. Runs only for API-authenticated users
-- (auth.uid() is not null); SQL Editor and service-role calls bypass it, which
-- is what lets the SQL below promote the first admin.
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Transaction-local flag set only inside redeem_staff_invite(), which is the
  -- single sanctioned path for a non-admin to receive a staff role.
  if auth.uid() is not null and not public.is_admin()
     and coalesce(current_setting('gateqr.allow_role_change', true), 'off') <> 'on' then
    if new.role is distinct from old.role
       or new.active is distinct from old.active
       or new.pass_enabled is distinct from old.pass_enabled
       or new.id_number is distinct from old.id_number
       or new.email is distinct from old.email
       or new.id is distinct from old.id then
      raise exception 'You are not allowed to modify protected fields.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- profiles
drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff" on public.profiles for select
  using (id = auth.uid() or public.is_staff());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles for update
  using (public.is_admin());
drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles for insert
  with check (public.is_admin());

-- settings
drop policy if exists "settings_select_all" on public.settings;
create policy "settings_select_all" on public.settings for select
  using (auth.role() = 'authenticated');
drop policy if exists "settings_update_admin" on public.settings;
create policy "settings_update_admin" on public.settings for update
  using (public.is_admin());

-- vehicles
drop policy if exists "vehicles_select_own_or_staff" on public.vehicles;
create policy "vehicles_select_own_or_staff" on public.vehicles for select
  using (user_id = auth.uid() or public.is_staff());
-- Owners can only ever submit pending registrations; only an admin can approve.
drop policy if exists "vehicles_insert_own" on public.vehicles;
create policy "vehicles_insert_own" on public.vehicles for insert
  with check (user_id = auth.uid() and status = 'pending');
drop policy if exists "vehicles_update_own_pending" on public.vehicles;
create policy "vehicles_update_own_pending" on public.vehicles for update
  using (user_id = auth.uid() and status = 'pending')
  with check (user_id = auth.uid() and status = 'pending');
drop policy if exists "vehicles_update_admin" on public.vehicles;
create policy "vehicles_update_admin" on public.vehicles for update
  using (public.is_admin());
drop policy if exists "vehicles_delete_own_or_admin" on public.vehicles;
create policy "vehicles_delete_own_or_admin" on public.vehicles for delete
  using (user_id = auth.uid() or public.is_admin());

-- visitor_passes (gate staff only)
drop policy if exists "visitor_passes_staff_all" on public.visitor_passes;
create policy "visitor_passes_staff_all" on public.visitor_passes for all
  using (public.is_staff()) with check (public.is_staff());

-- gate_logs
drop policy if exists "gate_logs_select_staff" on public.gate_logs;
create policy "gate_logs_select_staff" on public.gate_logs for select
  using (public.is_staff());
drop policy if exists "gate_logs_select_own_vehicle" on public.gate_logs;
create policy "gate_logs_select_own_vehicle" on public.gate_logs for select
  using (ref_id in (select id::text from public.vehicles where user_id = auth.uid()));
drop policy if exists "gate_logs_insert_staff" on public.gate_logs;
create policy "gate_logs_insert_staff" on public.gate_logs for insert
  with check (public.is_staff());

-- notifications
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select
  using (user_id = auth.uid());
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications_insert_staff" on public.notifications;
create policy "notifications_insert_staff" on public.notifications for insert
  with check (public.is_staff());
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications for delete
  using (user_id = auth.uid());

-- ============================================================================
-- Storage: private bucket for ID card uploads (front/back)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('id-documents', 'id-documents', false)
on conflict (id) do nothing;

drop policy if exists "id_documents_insert_own" on storage.objects;
create policy "id_documents_insert_own" on storage.objects for insert
  with check (bucket_id = 'id-documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "id_documents_select_own_or_staff" on storage.objects;
create policy "id_documents_select_own_or_staff" on storage.objects for select
  using (bucket_id = 'id-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
drop policy if exists "id_documents_delete_own_or_staff" on storage.objects;
create policy "id_documents_delete_own_or_staff" on storage.objects for delete
  using (bucket_id = 'id-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- ============================================================================
-- Demo account roles: promote the seeded demo admin/guard accounts.
-- Harmless if those emails do not exist (the update simply matches no rows).
-- ============================================================================
update public.profiles set role = 'admin', department = 'Administration / Offices' where email = 'admin@nwssu.edu.ph';
update public.profiles set role = 'guard', department = 'Administration / Offices' where email = 'guard@nwssu.edu.ph';
