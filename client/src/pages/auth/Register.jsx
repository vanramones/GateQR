import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import { useUserAuth } from '../../context/AuthContext';
import { Alert, Spinner } from '../../components/ui';
import PasswordInput from './PasswordInput';

const inputCls = 'input border-white/10 bg-white/5 text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-emerald-400/20';
const labelCls = 'mb-1.5 block text-sm font-medium text-slate-300';

export default function Register() {
  const { register } = useUserAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', role: 'student', idNumber: '', department: '', phone: '', password: '', confirm: '' });
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const validate = () => {
    const x = {};
    if (f.name.trim().length < 3) x.name = 'Enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) x.email = 'Enter a valid email address.';
    if (!f.idNumber.trim()) x.idNumber = 'ID number is required.';
    if (!/^(09|\+639)\d{9}$/.test(f.phone.replace(/\s/g, ''))) x.phone = 'Use a valid PH mobile number (e.g. 09171234567).';
    if (f.password.length < 8) x.password = 'Password must be at least 8 characters.';
    if (f.password !== f.confirm) x.confirm = 'Passwords do not match.';
    setErrs(x);
    return !Object.keys(x).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!validate()) return;
    setBusy(true);
    try { await register(f); nav('/app'); } catch (x) { setErr(x.message); setBusy(false); }
  };

  const err_ = (k) => errs[k] && <p className="mt-1 text-xs font-medium text-red-400">{errs[k]}</p>;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <img src="/images/campus-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/95 via-emerald-950/80 to-emerald-950/40" />
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl">
          <div className="rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl ring-1 ring-white/5 backdrop-blur-2xl">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-700 text-white shadow-md"><QrCode className="h-5 w-5" /></div>
                <span className="text-2xl font-extrabold text-white drop-shadow">GateQR</span>
              </div>
              <h1 className="text-xl font-bold text-white">Create your account</h1>
              <p className="mt-1 text-sm text-slate-300">Create an account to start registering your vehicles.</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {err && <Alert>{err}</Alert>}
              <div>
                <label className={labelCls}>Full name</label>
                <input className={inputCls} placeholder="Juan Dela Cruz" value={f.name} onChange={set('name')} />
                {err_('name')}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>I am a</label>
                  <select className={inputCls} value={f.role} onChange={set('role')}>
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="staff">University Staff</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-400">Faculty can register up to 5 vehicles; students and staff up to 3.</p>
                </div>
                <div>
                  <label className={labelCls}>ID number</label>
                  <input className={inputCls} placeholder="2022-00123" value={f.idNumber} onChange={set('idNumber')} />
                  {err_('idNumber')}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Email address</label>
                  <input type="email" className={inputCls} placeholder="you@nwssu.edu.ph" value={f.email} onChange={set('email')} />
                  {err_('email')}
                </div>
                <div>
                  <label className={labelCls}>Mobile number</label>
                  <input className={inputCls} placeholder="09171234567" value={f.phone} onChange={set('phone')} />
                  {err_('phone')}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Password</label>
                  <PasswordInput dark value={f.password} onChange={set('password')} placeholder="Create a password" />
                  {err_('password') || <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>}
                </div>
                <div>
                  <label className={labelCls}>Confirm password</label>
                  <PasswordInput dark value={f.confirm} onChange={set('confirm')} placeholder="Repeat password" />
                  {err_('confirm')}
                </div>
              </div>
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-400" disabled={busy}>
                {busy ? <Spinner /> : 'Create account'}
              </button>
              <p className="text-center text-sm text-slate-400">Already have an account? <Link to="/login" className="font-semibold text-emerald-400 hover:text-emerald-300">Sign in</Link></p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
