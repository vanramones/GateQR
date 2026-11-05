import { Link } from 'react-router-dom';
import { QrCode, ShieldCheck, FileText, Ticket, BarChart3, Smartphone, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Logo } from '../../components/ui';

const FEATURES = [
  [FileText, 'Online Vehicle Registration', 'Submit driver and vehicle details anytime — no more paper forms or long queues.'],
  [QrCode, 'Unique QR Pass', 'Every approved vehicle gets its own QR code that replaces physical stickers.'],
  [ShieldCheck, 'Instant Gate Verification', 'Guards scan the QR to verify validity in seconds and log every entry and exit.'],
  [Ticket, 'Visitor Passes', 'Issue short-term passes with limited validity for temporary campus guests.'],
  [BarChart3, 'Reports & Monitoring', 'Centralized records, gate logs, and exportable reports for administrators.'],
  [Smartphone, 'Works on Any Device', 'Responsive design for computers, tablets, and mobile phones.'],
];
const STEPS = [['Create an account', 'Sign up using your NWSSU details.'], ['Register your vehicle', 'Fill in the vehicle and driver information.'], ['Get approved', 'The administrator reviews and approves your request.'], ['Scan at the gate', 'Show your QR pass for instant verification.']];

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo light />
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-secondary">Sign in</Link>
            <Link to="/register" className="btn-primary hidden sm:inline-flex">Create account</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 text-white">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2">
          <div>
            <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-100 ring-1 ring-white/20">Northwest Samar State University</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Vehicle Pass Registration, <span className="text-brand-300">made digital.</span></h1>
            <p className="mt-5 max-w-xl text-lg text-brand-100">GateQR replaces paper-based gate pass registration with a secure web platform — register online, get a unique QR code, and enter campus with a quick scan.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="btn bg-white text-brand-800 hover:bg-brand-50">Get started <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/login" className="btn border border-white/30 text-white hover:bg-white/10">Sign in</Link>
            </div>
          </div>
          <div className="mx-auto w-full max-w-sm">
            <div className="rounded-2xl bg-white p-6 text-slate-800 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <Logo />
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">APPROVED</span>
              </div>
              <div className="flex items-center justify-center rounded-xl bg-slate-50 p-5"><QrCode className="h-36 w-36 text-slate-900" strokeWidth={1.2} /></div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-slate-400">Plate No.</div><div className="font-semibold">ABC 1234</div></div>
                <div><div className="text-xs text-slate-400">Vehicle</div><div className="font-semibold">Honda Click</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">Everything you need for campus vehicle access</h2>
          <p className="mt-3 text-slate-400">A complete solution for students, faculty, staff, visitors, administrators, and gate security.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([Icon, t, d]) => (
            <div key={t} className="card p-6 transition hover:-translate-y-0.5 hover:border-brand-400/30">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400"><Icon className="h-6 w-6" /></div>
              <h3 className="font-semibold text-white">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-white/5 bg-black/20 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold tracking-tight text-white">How it works</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, d], i) => (
              <div key={t} className="relative">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 font-bold text-white">{i + 1}</div>
                <h3 className="font-semibold text-white">{t}</h3>
                <p className="mt-1 text-sm text-slate-400">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
            {['No paper forms', 'No sticker shortages', 'Real-time verification'].map((x) => <span key={x} className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-400" />{x}</span>)}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-500">
        <div>&copy; {new Date().getFullYear()} GateQR: Vehicle Pass Registration System &middot; Northwest Samar State University, Calbayog City</div>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs font-medium">
          <Link to="/admin/login" className="text-slate-500 hover:text-brand-400">Admin Portal</Link>
          <Link to="/guard/login" className="text-slate-500 hover:text-brand-400">Guard Portal</Link>
        </div>
      </footer>
    </div>
  );
}
