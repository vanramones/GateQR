import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, KeyRound, User, Phone, ArrowLeft, ShieldAlert } from 'lucide-react';
import { useStaffAuth } from '../../context/AuthContext';
import { staffApi as api } from '../../lib/db';
import { Alert, Field, Logo, Spinner } from '../../components/ui';
import PasswordInput from './PasswordInput';

export default function StaffRegister() {
  const { registerStaff, setUser } = useStaffAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', inviteCode: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.password.length < 8) return setErr('Password must be at least 8 characters.');
    if (!f.inviteCode.trim()) return setErr('An invite code from the administrator is required.');
    setBusy(true);
    try {
      const u = await registerStaff(f);
      if (u.role !== 'admin') {
        await api.logout(); setUser(null);
        setErr('That invite code is for a gate guard account. Please create your account on the Guard Sign-up page.');
        setBusy(false);
        return;
      }
      nav('/admin');
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand-600/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-brand-800/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo light size="lg" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-400 ring-1 ring-inset ring-amber-500/30">
            <ShieldAlert className="h-3.5 w-3.5" />Admin Sign-up
          </span>
          <div className="text-lg font-semibold text-white">Create your administrator account</div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl backdrop-blur">
          <form onSubmit={submit} className="space-y-4">
            {err && <Alert>{err}</Alert>}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Full name</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input className="input border-slate-700 bg-slate-800 pl-10 text-white placeholder-slate-500 focus:border-brand-400" placeholder="Juan Dela Cruz" value={f.name} onChange={set('name')} required autoFocus />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Official email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input type="email" className="input border-slate-700 bg-slate-800 pl-10 text-white placeholder-slate-500 focus:border-brand-400" placeholder="admin@nwssu.edu.ph" value={f.email} onChange={set('email')} required />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Mobile number</label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input className="input border-slate-700 bg-slate-800 pl-10 text-white placeholder-slate-500 focus:border-brand-400" placeholder="09171234567" value={f.phone} onChange={set('phone')} required />
              </div>
            </div>
            <Field label={<span className="text-slate-300">Password</span>} hint={<span className="text-slate-500">At least 8 characters.</span>}>
              <PasswordInput dark value={f.password} onChange={set('password')} placeholder="Create a password" />
            </Field>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Invite code</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input className="input border-slate-700 bg-slate-800 pl-10 uppercase tracking-widest text-white placeholder-slate-500 focus:border-brand-400" placeholder="ABCDE" value={f.inviteCode} onChange={set('inviteCode')} required />
              </div>
              <p className="mt-1 text-xs text-slate-500">Ask the system administrator for a one-time invite code.</p>
            </div>
            <button className="btn w-full bg-white font-semibold text-slate-900 hover:bg-brand-50" disabled={busy}>{busy ? <Spinner /> : 'Create admin account'}</button>
          </form>
        </div>

        <p className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-center text-sm text-slate-500">
          <Link to="/admin/login" className="inline-flex items-center gap-1.5 font-medium text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" />Back to admin sign-in</Link>
          <Link to="/guard/register" className="font-medium text-slate-500 hover:text-brand-400">Gate guard invite? Sign up here</Link>
        </p>
      </div>
    </div>
  );
}
