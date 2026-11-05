import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, QrCode } from 'lucide-react';
import { useUserAuth } from '../../context/AuthContext';
import { userApi as api } from '../../lib/db';
import { Alert, Spinner } from '../../components/ui';

const STAFF_ROLES = ['admin', 'guard'];
const VALUES = [
  ['R', 'esilience'], ['I', 'ntegrity'], ['S', 'ervice'], ['E', 'xcellence'],
];

export default function Login() {
  const { login, loginWithGoogle, user, setUser } = useUserAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Guard against a staff/admin account completing sign-in via Google on this page.
  useEffect(() => {
    if (user && STAFF_ROLES.includes(user.role)) {
      api.logout().then(() => { setUser(null); setErr('Staff and administrator accounts must sign in through the Administrative Portal.'); });
    } else if (user) {
      nav('/app');
    }
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const u = await login(f.email, f.password);
      if (STAFF_ROLES.includes(u.role)) {
        await api.logout(); setUser(null);
        setErr('Staff and administrator accounts must sign in through the Administrative Portal.');
        setBusy(false);
        return;
      }
      nav('/app');
    } catch (x) { setErr(x.message); setBusy(false); }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <img src="/images/campus-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/95 via-emerald-950/80 to-emerald-950/40" />
      <div className="absolute inset-0 bg-black/20" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div className="pointer-events-none absolute inset-y-0 right-4 hidden select-none items-center xl:right-16 lg:flex">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Our Core Values</div>
            <div className="relative bg-gradient-to-b from-white via-white to-emerald-200/80 bg-clip-text text-[8rem] font-black leading-[0.9] tracking-tighter text-transparent drop-shadow-[0_8px_40px_rgba(0,0,0,0.55)] xl:text-[10.5rem]" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.15)' }}>
              RISE
            </div>
            <div className="mt-5 h-1.5 w-40 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-400/0" />
            <ul className="mt-7 space-y-3 text-2xl font-semibold text-emerald-50/90 xl:text-3xl">
              {VALUES.map(([letter, rest]) => (
                <li key={letter} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/15 text-xl font-extrabold text-emerald-300 ring-1 ring-emerald-400/30 xl:h-10 xl:w-10">{letter}</span>
                  {rest}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative w-full max-w-md">
          <div className="rounded-3xl border border-white/15 bg-white/10 p-8 shadow-2xl ring-1 ring-white/5 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/10">
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-700 text-white shadow-md"><QrCode className="h-5 w-5" /></div>
                <span className="text-2xl font-extrabold text-white drop-shadow">GateQR</span>
              </div>
              <p className="text-sm text-slate-200">Intelligent vehicle pass &amp; security access management</p>
            </div>

            {err && <div className="mb-4"><Alert>{err}</Alert></div>}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input type="email" required autoFocus placeholder="you@mail.com" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input type={show ? 'text' : 'password'} required placeholder="Enter your password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20" />
                  <button type="button" onClick={() => setShow(!show)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-400" disabled={busy}>
                {busy ? <Spinner /> : 'Sign in'}
              </button>
              <p className="text-center text-sm text-slate-400">No account? <Link to="/register" className="font-semibold text-emerald-400 hover:text-emerald-300">Register</Link></p>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Or continue with</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button type="button" onClick={loginWithGoogle} className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-white py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-100">
              <GoogleIcon /> Continue with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.5c-2 1.4-4.6 2.3-7.6 2.3-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.4 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.5C41.6 36 44 30.6 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}
