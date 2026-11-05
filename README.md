# GateQR

QR-based vehicle pass registration and gate access system for **Northwest Samar State University (NWSSU)**.

Students, faculty, and staff register their vehicles online and receive a QR pass. Gate guards scan the pass to verify it and log every entry and exit. The office (admin) reviews and approves registrations, manages users, and views reports.

## Portals

The app runs three separate portals, each with its own independent login session:

| Portal | Route | Users | What it does |
|---|---|---|---|
| Community | `/app` | Students, faculty, staff | Register vehicles, upload documents, view QR pass, gate logs, notifications |
| Admin | `/admin` | Office administrators | Approve/reject registrations, manage users & staff invites, reports, system settings |
| Guard | `/guard` | Gate guards | Scan QR passes, log gate entry/exit, issue visitor passes |

## Features

- Vehicle registration with document uploads (ID front/back, selfie, vehicle photos, OR/CR proof)
- Admin approval workflow with email notifications (payment notice, status notice)
- QR code generation (`qrcode.react`) and camera scanning (`html5-qrcode`)
- Gate entry/exit logging with grant/deny results
- Visitor passes with configurable validity
- In-app notifications and reports (PDF export via `pdfkit`)
- One active registration per plate — rejected records can be re-submitted
- Staff invite codes: the only way admin/guard accounts are granted, no service-role key in the frontend

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router 6, Lucide icons — in `client/`
- **Backend:** Supabase (PostgreSQL, Auth, Storage) with Row Level Security — schema in `supabase/schema.sql`
- **Hosting:** Vercel, with serverless functions in `client/api/` for outbound email (Resend, with SMTP fallback via Nodemailer)

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In the dashboard, open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it
3. Sign up the first admin/guard accounts, then re-run the last two `UPDATE` statements in the schema (or promote them by email in the profiles table)

### 2. Client

```bash
cd client
npm install
cp .env.example .env
```

Fill in `client/.env`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then:

```bash
npm run dev      # local dev server
npm run build    # production build → dist/
```

### 3. Email (Vercel deployment)

Set these in **Vercel → Settings → Environment Variables**:

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Recommended — sends from a GateQR mailbox via [Resend](https://resend.com) |
| `RESEND_FROM` | Optional sender address (verified domain) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | SMTP fallback if Resend is not configured |

## Repo Layout

```
client/          Vite + React app and Vercel serverless functions
  api/           Email endpoints (payment & status notices)
  src/pages/     auth/, user/, admin/, shared/ portal pages
supabase/        schema.sql — tables, RLS policies, triggers, storage bucket
```

## Security Notes

- All tables use Row Level Security; owners can only see/edit their own pending registrations
- Admin/guard roles can only be granted via one-time staff invite codes (`redeem_staff_invite()`)
- The private `id-documents` storage bucket restricts uploads to each user's own folder
- Never commit `.env` — the anon key is safe to expose (RLS protects data), but secrets like `RESEND_API_KEY` must stay server-side
