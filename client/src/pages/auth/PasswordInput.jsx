import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

export default function PasswordInput({ value, onChange, placeholder = 'Enter your password', id, dark = false }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input id={id} type={show ? 'text' : 'password'}
        className={dark ? 'input border-slate-700 bg-slate-800 pl-10 pr-10 text-white placeholder-slate-500 focus:border-brand-400' : 'input pl-10 pr-10'}
        value={value} onChange={onChange} placeholder={placeholder} required />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" tabIndex={-1}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
