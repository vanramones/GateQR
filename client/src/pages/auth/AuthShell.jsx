import { Link } from 'react-router-dom';
import { QrCode, ShieldCheck, Zap } from 'lucide-react';
import { Logo } from '../../components/ui';

export default function AuthShell({ title, subtitle, children, wide, badge }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 p-12 text-white lg:flex">
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <Link to="/"><Logo light /></Link>
        <div className="relative">
          <h2 className="text-4xl font-extrabold leading-tight">Secure campus access,<br />one scan away.</h2>
          <p className="mt-4 max-w-md text-brand-100">Register your vehicle online, receive a unique QR pass, and enter Northwest Samar State University without the paperwork.</p>
          <ul className="mt-8 space-y-4 text-sm">
            {[[QrCode, 'Unique QR code for every vehicle'], [ShieldCheck, 'Instant verification at campus gates'], [Zap, 'Fast online registration and renewal']].map(([I, t]) => (
              <li key={t} className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"><I className="h-5 w-5" /></span>{t}</li>
            ))}
          </ul>
        </div>
        <div className="relative text-xs text-brand-200">&copy; {new Date().getFullYear()} GateQR &middot; NWSSU, Calbayog City</div>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'}`}>
          <div className="mb-8 lg:hidden"><Link to="/"><Logo /></Link></div>
          {badge}
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
