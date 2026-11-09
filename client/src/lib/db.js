import { createClient } from '@supabase/supabase-js';
import { supabaseUser, supabaseStaff, supabaseGuard } from './supabase';

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const DEFAULT_SETTINGS = {
  campusName: 'Northwest Samar State University',
  gateName: 'Main Gate',
  defaultValidityMonths: 12,
  expiryReminderDays: 30,
  defaultVisitorHours: 4,
  maxVisitorHours: 24,
  requireLicenseCheck: true,
  maxVehicleSlots: 300,
};

export const ROLES = { admin: 'Administrator', guard: 'Gate Guard', student: 'Student', faculty: 'Faculty', staff: 'Staff' };
export const MAX_VEHICLES_PER_USER = 3;
export const MAX_VEHICLES_BY_ROLE = { faculty: 5 };
export const maxVehiclesForRole = (role) => MAX_VEHICLES_BY_ROLE[role] || MAX_VEHICLES_PER_USER;
export const VEHICLE_TYPES = ['Motorcycle', 'Car', 'Tricycle', 'Van'];
export const DEPARTMENTS = [
  'College of Computing and Information Sciences', 'College of Engineering', 'College of Education',
  'College of Business and Management', 'College of Arts and Sciences', 'College of Criminal Justice',
  'Administration / Offices',
];

const ID_BUCKET = 'id-documents';

function friendlyError(error) {
  const msg = error?.message || 'Something went wrong. Please try again.';
  if (/already registered/i.test(msg)) return new Error('An account with this email already exists.');
  if (/profiles_id_number_unique/i.test(msg)) return new Error('This ID number is already registered.');
  if (/vehicles_plate_active_unique/i.test(msg)) return new Error('This plate number is already registered.');
  if (/Invalid login credentials/i.test(msg)) return new Error('Invalid email or password.');
  return new Error(msg);
}

// ---------- row <-> app object mappers (DB is snake_case, app uses camelCase) ----------
const mapProfile = (r) => r && ({
  id: r.id, name: r.name, email: r.email, role: r.role, idNumber: r.id_number || '',
  department: r.department || '', phone: r.phone || '', active: r.active, passEnabled: r.pass_enabled !== false, createdAt: new Date(r.created_at).getTime(),
});
const mapVehicle = (r) => r && ({
  id: r.id, userId: r.user_id, type: r.type, plate: r.plate, make: r.make, model: r.model, color: r.color, year: r.year,
  orcrNo: r.orcr_no, licenseNo: r.license_no, licenseExpiry: r.license_expiry,
  idFrontPath: r.id_front_path, idBackPath: r.id_back_path, selfiePath: r.selfie_path, vehiclePhotoPath: r.vehicle_photo_path,
  vehicleFrontPath: r.vehicle_front_path, vehicleSidePath: r.vehicle_side_path, vehicleBackPath: r.vehicle_back_path,
  proofDocPath: r.proof_doc_path,
  passEnabled: r.pass_enabled !== false, accessStart: r.access_start ? r.access_start.slice(0, 5) : '', accessEnd: r.access_end ? r.access_end.slice(0, 5) : '',
  paymentNoticeSentAt: r.payment_notice_sent_at ? new Date(r.payment_notice_sent_at).getTime() : null,
  paymentReceiptPath: r.payment_receipt_path,
  status: r.status, remarks: r.remarks || '', createdAt: new Date(r.created_at).getTime(),
  approvedAt: r.approved_at ? new Date(r.approved_at).getTime() : null,
  validUntil: r.valid_until ? new Date(r.valid_until).getTime() : null,
});
const mapPass = (r) => r && ({
  id: r.id, visitorName: r.visitor_name, plate: r.plate, vehicleType: r.vehicle_type, purpose: r.purpose, host: r.host,
  contact: r.contact, issuedBy: r.issued_by, createdAt: new Date(r.created_at).getTime(),
  validUntil: new Date(r.valid_until).getTime(), status: r.status,
});
const mapLog = (r) => r && ({
  id: r.id, code: r.code, type: r.type, refId: r.ref_id, plate: r.plate, name: r.name, action: r.action,
  result: r.result, reason: r.reason || '', guardId: r.guard_id, timestamp: new Date(r.timestamp).getTime(),
});
const mapSettings = (r) => ({
  campusName: r.campus_name, gateName: r.gate_name, defaultValidityMonths: r.default_validity_months,
  expiryReminderDays: r.expiry_reminder_days, defaultVisitorHours: r.default_visitor_hours,
  maxVisitorHours: r.max_visitor_hours, requireLicenseCheck: r.require_license_check, maxVehicleSlots: r.max_vehicle_slots,
});

export const vehicleStatus = (v) => (v.status === 'approved' && v.validUntil && v.validUntil < Date.now() ? 'expired' : v.status);
export const passStatus = (p) => (p.status === 'revoked' ? 'revoked' : p.validUntil < Date.now() ? 'expired' : 'active');
// Uppercased so the QR encoder can use its compact Alphanumeric mode (digits,
// A-Z, space $%*+-./:) instead of Byte mode, which a lowercase UUID would
// force. Alphanumeric mode packs ~2x more data per module, producing a
// lower-version QR with larger, easier-to-decode modules at the same print
// size — this meaningfully improves camera scan reliability. Safe to do
// because verify() already normalizes the scanned text with .toUpperCase()
// then .toLowerCase() before the DB lookup, so casing here has zero effect
// on correctness.
export const withinAccessWindow = (start, end, now = new Date()) => {
  if (!start || !end) return true;
  const m = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = sh * 60 + sm, e = eh * 60 + em;
  return s <= e ? m >= s && m <= e : m >= s || m <= e;
};
const fmtClock = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
};
export const vehicleCode = (v) => `GATEQR:V:${v.id}`.toUpperCase();
export const passCode = (p) => `GATEQR:P:${p.id}`.toUpperCase();

// Builds a full `api` object bound to a specific Supabase client/session. Two
// instances are created below (one per auth client) so the community portal
// and the admin/guard portal always act on their own independent session.
function createApi(supabase) {
  async function getProfile(id) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error) throw friendlyError(error);
    if (!data) {
      await supabase.auth.signOut();
      throw new Error('This account has no profile record in the system. Ask the administrator to set it up, then try again.');
    }
    return mapProfile(data);
  }

  async function uploadIdDoc(userId, vehicleId, side, doc) {
    if (!doc?.file) return null;
    const ext = (doc.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/${vehicleId}-${side}.${ext}`;
    const { error } = await supabase.storage.from(ID_BUCKET).upload(path, doc.file, { upsert: true, contentType: doc.type });
    if (error) throw friendlyError(error);
    return path;
  }

  return {
    async init() {},

    async getSettings() {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
      if (error) throw friendlyError(error);
      return mapSettings(data);
    },
    async updateSettings(patch) {
      const row = {};
      if (patch.campusName !== undefined) row.campus_name = patch.campusName;
      if (patch.gateName !== undefined) row.gate_name = patch.gateName;
      if (patch.defaultValidityMonths !== undefined) row.default_validity_months = patch.defaultValidityMonths;
      if (patch.expiryReminderDays !== undefined) row.expiry_reminder_days = patch.expiryReminderDays;
      if (patch.defaultVisitorHours !== undefined) row.default_visitor_hours = patch.defaultVisitorHours;
      if (patch.maxVisitorHours !== undefined) row.max_visitor_hours = patch.maxVisitorHours;
      if (patch.requireLicenseCheck !== undefined) row.require_license_check = patch.requireLicenseCheck;
      if (patch.maxVehicleSlots !== undefined) row.max_vehicle_slots = patch.maxVehicleSlots;
      const { data, error } = await supabase.from('settings').update(row).eq('id', 1).select().single();
      if (error) throw friendlyError(error);
      return mapSettings(data);
    },

    async getSlotStats() {
      const settings = await this.getSettings();
      const { count, error } = await supabase.from('vehicles').select('id', { count: 'exact', head: true }).in('status', ['pending', 'approved']);
      if (error) throw friendlyError(error);
      const used = count || 0;
      return { total: settings.maxVehicleSlots, used, available: Math.max(0, settings.maxVehicleSlots - used), full: used >= settings.maxVehicleSlots };
    },

    async login(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw friendlyError(error);
      const profile = await getProfile(data.user.id);
      if (!profile.active) { await supabase.auth.signOut(); throw new Error('This account has been deactivated. Contact the administrator.'); }
      return profile;
    },
    async register(data) {
      const { data: res, error } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: { data: { name: data.name.trim(), role: data.role, id_number: data.idNumber.trim(), department: data.department, phone: data.phone.trim() } },
      });
      if (error) throw friendlyError(error);
      if (!res.session) throw new Error('Account created. Please check your email to confirm your address before signing in.');
      return getProfile(res.user.id);
    },
    async logout() { await supabase.auth.signOut(); },
    async currentUser() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return null;
      try { return await getProfile(data.session.user.id); } catch { return null; }
    },
    async updateProfile(id, patch) {
      const row = {};
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.phone !== undefined) row.phone = patch.phone;
      if (patch.department !== undefined) row.department = patch.department;
      if (Object.keys(row).length) {
        const { error } = await supabase.from('profiles').update(row).eq('id', id);
        if (error) throw friendlyError(error);
      }
      if (patch.password) {
        const { error } = await supabase.auth.updateUser({ password: patch.password });
        if (error) throw friendlyError(error);
      }
      return getProfile(id);
    },

    async listUsers() {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw friendlyError(error);
      return data.map(mapProfile);
    },
    async setUserActive(id, active) {
      const { error } = await supabase.from('profiles').update({ active }).eq('id', id);
      if (error) throw friendlyError(error);
    },
    async setUserPassEnabled(id, passEnabled) {
      const { error } = await supabase.from('profiles').update({ pass_enabled: passEnabled }).eq('id', id);
      if (error) throw friendlyError(error);
    },
    async setUserRole(id, role) {
      if (!['student', 'faculty', 'staff'].includes(role)) throw new Error('Invalid role.');
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
      if (error) throw friendlyError(error);
    },

    // ---------- Staff invites (replaces direct admin/guard account creation) ----------
    // Admins never hold the power to set a Supabase Auth password for someone else
    // from the browser (that requires the service_role key, which must stay off the
    // client). Instead, an admin issues a one-time code; the new staff member signs
    // up themselves on the Staff Sign-up page and redeems it to receive their role.
    async listStaffInvites() {
      const { data, error } = await supabase.from('staff_invites').select('*').order('created_at', { ascending: false });
      if (error) throw friendlyError(error);
      return data.map((r) => ({ code: r.code, role: r.role, createdAt: new Date(r.created_at).getTime(), redeemedAt: r.redeemed_at ? new Date(r.redeemed_at).getTime() : null }));
    },
    async createStaffInvite(role) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(5))).map((b) => (b % 36).toString(36)).join('').toUpperCase();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('staff_invites').insert({ code, role, created_by: user.id });
      if (error) throw friendlyError(error);
      return code;
    },
    // Admin: directly create a staff account (admin or guard) with a password
    // so multiple staff can sign in without an invite code. Uses a throwaway,
    // non-persisted Supabase client for signUp so the admin's own session on
    // this client is never replaced; then upgrades the new profile's role via
    // the admin's own session (allowed by the profiles_update_admin policy).
    async createStaffAccount({ name, email, phone, password, role }) {
      if (!['admin', 'guard'].includes(role)) throw new Error('Invalid role.');
      const tmp = createClient(SUPA_URL, SUPA_ANON, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data: res, error } = await tmp.auth.signUp({
        email: email.trim(), password,
        options: { data: { name: name.trim(), phone: (phone || '').trim() } },
      });
      if (error) throw friendlyError(error);
      try { await tmp.auth.signOut(); } catch { /* session only in memory */ }
      if (!res.user) throw new Error('Account creation failed.');
      const { error: updErr } = await supabase.from('profiles').update({ role }).eq('id', res.user.id);
      if (updErr) throw friendlyError(updErr);
      return true;
    },
    async registerStaff(data) {
      const { data: res, error } = await supabase.auth.signUp({
        email: data.email.trim(),
        password: data.password,
        options: { data: { name: data.name.trim(), phone: data.phone.trim() } },
      });
      if (error) throw friendlyError(error);
      if (!res.session) throw new Error('Account created. Please check your email to confirm your address, then sign in and redeem your invite code.');
      const { error: rpcError } = await supabase.rpc('redeem_staff_invite', { invite_code: data.inviteCode.trim().toUpperCase() });
      if (rpcError) { await supabase.auth.signOut(); throw friendlyError(rpcError); }
      return getProfile(res.user.id);
    },

    async listVehicles(userId) {
      let q = supabase.from('vehicles').select('*').order('created_at', { ascending: false });
      if (userId) q = q.eq('user_id', userId);
      const { data, error } = await q;
      if (error) throw friendlyError(error);
      return data.map(mapVehicle);
    },
    async addVehicle(userId, data) {
      const settings = await this.getSettings();
      const [{ count }, { count: mine }, { data: me }] = await Promise.all([
        supabase.from('vehicles').select('id', { count: 'exact', head: true }).in('status', ['pending', 'approved']),
        supabase.from('vehicles').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('status', ['pending', 'approved']),
        supabase.from('profiles').select('role').eq('id', userId).maybeSingle(),
      ]);
      if ((count || 0) >= settings.maxVehicleSlots) throw new Error('All vehicle pass slots are currently full. Please try again later or contact the administrator.');
      const limit = maxVehiclesForRole(me?.role);
      if ((mine || 0) >= limit) throw new Error(`You can register a maximum of ${limit} vehicles. Delete or wait for a decision on an existing registration first.`);

      const id = crypto.randomUUID();
      const [idFrontPath, idBackPath, selfiePath, vehicleFrontPath, vehicleSidePath, vehicleBackPath, proofDocPath] = await Promise.all([
        uploadIdDoc(userId, id, 'front', data.idFront),
        uploadIdDoc(userId, id, 'back', data.idBack),
        uploadIdDoc(userId, id, 'selfie', data.selfie),
        uploadIdDoc(userId, id, 'vehicle-front', data.vehicleFront),
        uploadIdDoc(userId, id, 'vehicle-side', data.vehicleSide),
        uploadIdDoc(userId, id, 'vehicle-back', data.vehicleBack),
        uploadIdDoc(userId, id, 'proof', data.proofDoc),
      ]);
      const { data: row, error } = await supabase.from('vehicles').insert({
        id, user_id: userId, type: data.type, plate: data.plate.trim().toUpperCase(), make: data.make, model: data.model,
        color: data.color, year: data.year, orcr_no: data.orcrNo, license_no: data.licenseNo, license_expiry: data.licenseExpiry,
        id_front_path: idFrontPath, id_back_path: idBackPath, selfie_path: selfiePath,
        vehicle_front_path: vehicleFrontPath, vehicle_side_path: vehicleSidePath, vehicle_back_path: vehicleBackPath,
        proof_doc_path: proofDocPath,
      }).select().single();
      if (error) throw friendlyError(error);
      return mapVehicle(row);
    },
    async updateVehicle(id, patch) {
      const row = {};
      const map = { type: 'type', plate: 'plate', make: 'make', model: 'model', color: 'color', year: 'year', orcrNo: 'orcr_no', licenseNo: 'license_no', licenseExpiry: 'license_expiry', remarks: 'remarks', status: 'status' };
      for (const [k, col] of Object.entries(map)) if (patch[k] !== undefined) row[col] = k === 'plate' ? patch[k].trim().toUpperCase() : patch[k];
      if (patch.validUntil !== undefined) row.valid_until = patch.validUntil ? new Date(patch.validUntil).toISOString() : null;
      if (patch.passEnabled !== undefined) row.pass_enabled = patch.passEnabled;
      if (patch.accessStart !== undefined) row.access_start = patch.accessStart || null;
      if (patch.accessEnd !== undefined) row.access_end = patch.accessEnd || null;
      const { error } = await supabase.from('vehicles').update(row).eq('id', id);
      if (error) throw friendlyError(error);
    },
    async deleteVehicle(id) {
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (error) throw friendlyError(error);
    },
    async reviewVehicle(id, decision, remarks = '', validityMonths = 12, opts = {}) {
      const until = opts.validUntil ? new Date(opts.validUntil).getTime() : Date.now() + validityMonths * 30 * 86400000;
      const row = decision === 'approved'
        ? { status: 'approved', approved_at: new Date().toISOString(), valid_until: new Date(until).toISOString(), remarks: '', access_start: opts.accessStart || null, access_end: opts.accessEnd || null }
        : { status: 'rejected', remarks, valid_until: null };
      const { error } = await supabase.from('vehicles').update(row).eq('id', id);
      if (error) throw friendlyError(error);
    },
    async renewVehicle(id, validityMonths = 12) {
      const { error } = await supabase.from('vehicles').update({
        status: 'approved', approved_at: new Date().toISOString(), valid_until: new Date(Date.now() + validityMonths * 30 * 86400000).toISOString(),
      }).eq('id', id);
      if (error) throw friendlyError(error);
    },
    async getIdSignedUrls(vehicle) {
      const sign = async (path) => {
        if (!path) return null;
        const { data, error } = await supabase.storage.from(ID_BUCKET).createSignedUrl(path, 3600);
        return error ? null : data.signedUrl;
      };
      const [front, back, selfie, vehicleFront, vehicleSide, vehicleBack, vehiclePhoto, proof, receipt] = await Promise.all([
        sign(vehicle.idFrontPath), sign(vehicle.idBackPath), sign(vehicle.selfiePath),
        sign(vehicle.vehicleFrontPath), sign(vehicle.vehicleSidePath), sign(vehicle.vehicleBackPath),
        sign(vehicle.vehiclePhotoPath), sign(vehicle.proofDocPath), sign(vehicle.paymentReceiptPath),
      ]);
      return { front, back, selfie, vehicleFront, vehicleSide, vehicleBack, vehiclePhoto, proof, receipt };
    },

    // Admin: email the vehicle owner a PDF with cashier payment instructions.
    async sendPaymentNotice(vehicle, owner) {
      const res = await fetch('/api/send-payment-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: owner.email, ownerName: owner.name, plate: vehicle.plate, vehicle: `${vehicle.make} ${vehicle.model}`, controlNo: vehicle.plate }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to send the payment notice.');
      const { error } = await supabase.from('vehicles').update({ payment_notice_sent_at: new Date().toISOString() }).eq('id', vehicle.id);
      if (error) throw friendlyError(error);
    },
    // Vehicle owner: upload proof of payment (the cashier's official receipt).
    async uploadPaymentReceipt(vehicleId, userId, doc) {
      const path = await uploadIdDoc(userId, vehicleId, 'receipt', doc);
      const { error } = await supabase.from('vehicles').update({ payment_receipt_path: path }).eq('id', vehicleId);
      if (error) throw friendlyError(error);
    },

    async listPasses() {
      const { data, error } = await supabase.from('visitor_passes').select('*').order('created_at', { ascending: false });
      if (error) throw friendlyError(error);
      return data.map(mapPass);
    },
    async issuePass(issuedBy, data) {
      const { data: row, error } = await supabase.from('visitor_passes').insert({
        visitor_name: data.visitorName, plate: data.plate.trim().toUpperCase(), vehicle_type: data.vehicleType, purpose: data.purpose,
        host: data.host, contact: data.contact, issued_by: issuedBy, valid_until: new Date(Date.now() + Number(data.hours) * 3600000).toISOString(),
      }).select().single();
      if (error) throw friendlyError(error);
      return mapPass(row);
    },
    async revokePass(id) {
      const { error } = await supabase.from('visitor_passes').update({ status: 'revoked' }).eq('id', id);
      if (error) throw friendlyError(error);
    },

    async listLogs() {
      const { data, error } = await supabase.from('gate_logs').select('*').order('timestamp', { ascending: false }).limit(500);
      if (error) throw friendlyError(error);
      return data.map(mapLog);
    },

    async verify(rawCode) {
      const code = rawCode.trim().toUpperCase();
      const m = code.match(/^GATEQR:([VP]):(.+)$/);
      if (!m) return { ok: false, reason: 'Invalid QR code (not a GateQR pass).', code };
      if (m[1] === 'V') {
        const { data: v } = await supabase.from('vehicles').select('*').eq('id', m[2].toLowerCase()).maybeSingle();
        if (!v) return { ok: false, reason: 'Vehicle not found in the system.', code };
        const vehicle = mapVehicle(v);
        const owner = await getProfile(vehicle.userId).catch(() => null);
        const st = vehicleStatus(vehicle);
        const base = { code, kind: 'vehicle', vehicle, owner, name: owner?.name, plate: vehicle.plate, refId: vehicle.id };
        if (st === 'approved') {
          if (owner && owner.passEnabled === false) return { ok: false, ...base, reason: `QR pass is disabled for this ${owner.role || 'account'}.` };
          if (!vehicle.passEnabled) return { ok: false, ...base, reason: 'QR pass has been disabled by the administrator.' };
          if (!withinAccessWindow(vehicle.accessStart, vehicle.accessEnd)) return { ok: false, ...base, reason: `Outside allowed pass hours (${fmtClock(vehicle.accessStart)} – ${fmtClock(vehicle.accessEnd)}).` };
          return { ok: true, ...base };
        }
        return { ok: false, ...base, reason: { pending: 'Registration is still pending approval.', rejected: 'Registration was rejected.', expired: 'Pass expired.' }[st] };
      }
      const { data: p } = await supabase.from('visitor_passes').select('*').eq('id', m[2].toLowerCase()).maybeSingle();
      if (!p) return { ok: false, reason: 'Visitor pass not found.', code };
      const pass = mapPass(p);
      const st = passStatus(pass);
      const base = { code, kind: 'visitor', pass, name: pass.visitorName, plate: pass.plate, refId: pass.id };
      return st === 'active' ? { ok: true, ...base } : { ok: false, ...base, reason: st === 'revoked' ? 'Visitor pass was revoked.' : 'Visitor pass expired.' };
    },
    async lastAction(refId) {
      const { data } = await supabase.from('gate_logs').select('action').eq('ref_id', refId).eq('result', 'granted').order('timestamp', { ascending: false }).limit(1).maybeSingle();
      return data?.action || null;
    },
    async recordLog(entry) {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: row, error } = await supabase.from('gate_logs').insert({
        code: entry.code, type: entry.type, ref_id: entry.refId, plate: entry.plate, name: entry.name,
        action: entry.action, result: entry.result, reason: entry.reason || '', guard_id: entry.guardId || user?.id,
      }).select().single();
      if (error) throw friendlyError(error);
      return mapLog(row);
    },

    // ---------- Notifications ----------
    // Staff: write a notification to a vehicle owner (e.g. approval/rejection).
    async notifyUser(userId, title, body) {
      const { error } = await supabase.from('notifications').insert({ user_id: userId, title, body });
      if (error) throw friendlyError(error);
    },
    // Owner: read own notifications (newest first).
    async listNotifications() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      if (error) throw friendlyError(error);
      return data.map((r) => ({ id: r.id, title: r.title, body: r.body, read: r.read, createdAt: new Date(r.created_at).getTime() }));
    },
    async markNotificationsRead(ids) {
      if (!ids?.length) return;
      const { error } = await supabase.from('notifications').update({ read: true }).in('id', ids);
      if (error) throw friendlyError(error);
    },
    // Staff: email the owner that their registration was approved/rejected.
    async sendStatusNotice(vehicle, owner, decision, remarks = '') {
      const res = await fetch('/api/send-status-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: owner.email, ownerName: owner.name, plate: vehicle.plate,
          vehicle: `${vehicle.make} ${vehicle.model}`, decision, remarks,
          validUntil: vehicle.validUntil ? new Date(vehicle.validUntil).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to send the notification email.');
    },
  };
}

// Community portal (student / faculty / staff) — bound to its own session.
export const userApi = createApi(supabaseUser);
// Admin (office) portal — bound to its own, independent session.
export const staffApi = createApi(supabaseStaff);
// Gate guard portal — bound to its own, independent session.
export const guardApi = createApi(supabaseGuard);
