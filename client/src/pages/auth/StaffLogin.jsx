import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ShieldCheck, Lock, ArrowLeft, ShieldAlert, QrCode } from 'lucide-react';
import { useStaffAuth } from '../../context/AuthContext';
import { staffApi as api } from '../../lib/db';
import { Alert, Spinner } from '../../components/ui';
import PasswordInput from './PasswordInput';

const inputCls = 'w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20';
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-300';

export default function StaffLogin() {
  const { login, setUser } = useStaffAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const u = await login(f.email, f.password);
      if (u.role !== 'admin') {
        await api.logout(); setUser(null);
        setErr('This portal is for administrators only. Gate guards should use the Guard Portal, and students/faculty/staff should use the community sign-in page.');
        setBusy(false);
        return;
      }
      nav('/admin');
    } catch (x) { setErr(x.message); setBusy(false); }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <img src="/images/campus-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/85 to-emerald-950/60" />
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl ring-1 ring-white/5 backdrop-blur-2xl">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-700 text-white shadow-md"><QrCode className="h-5 w-5" /></div>
                <span className="text-2xl font-extrabold text-white drop-shadow">GateQR</span>
              </div>
              <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-400 ring-1 ring-inset ring-amber-500/30">
                <ShieldAlert className="h-3.5 w-3.5" />Admin Login
              </span>
              <h1 className="text-lg font-bold text-white">Administrative Portal</h1>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-widest text-amber-400/80">
                <Lock className="h-3 w-3" /> Authorized personnel only
              </div>
            </div>

            <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <ShieldCheck className="h-8 w-8 shrink-0 text-amber-400" />
              <p className="text-xs leading-relaxed text-slate-400">This area is restricted to NWSSU system administrators managing registrations, reports, and campus records from the office. All sign-in attempts are recorded.</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {err && <Alert>{err}</Alert>}
              <div>
                <label className={labelCls}>Official email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input type="email" required autoFocus placeholder="admin@nwssu.edu.ph" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <PasswordInput dark value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
              </div>
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400" disabled={busy}>
                {busy ? <Spinner /> : 'Sign in to portal'}
              </button>
            </form>
          </div>

          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-sm text-slate-500">
            <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to community sign-in</Link>
            <Link to="/admin/register" className="font-medium text-amber-400 hover:text-amber-300">Have an invite code?</Link>
            <Link to="/guard/login" className="font-medium text-slate-500 hover:text-amber-400">Gate guard? Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
