import { useState } from 'react';
import { UserCircle } from 'lucide-react';
import { userApi, staffApi, DEPARTMENTS, ROLES } from '../../lib/db';
import { Alert, Field, PageHeader, Spinner } from '../../components/ui';

export default function Profile({ auth }) {
  const { user, setUser } = auth;
  const api = ['admin', 'guard'].includes(user.role) ? staffApi : userApi;
  const [f, setF] = useState({ name: user.name, phone: user.phone, department: user.department, password: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    if (f.password && f.password.length < 8) return setMsg('err');
    setBusy(true);
    const patch = { name: f.name, phone: f.phone, department: f.department };
    if (f.password) patch.password = f.password;
    setUser(await api.updateProfile(user.id, patch));
    setF({ ...f, password: '' });
    setBusy(false);
    setMsg('ok');
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My Profile" subtitle="Manage your account information." />

      <div className="card mb-6 flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:text-left">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-500 text-3xl font-bold text-white shadow-md">
          {user.name?.[0]?.toUpperCase() || <UserCircle className="h-10 w-10" />}
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{user.name}</div>
          <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-300 ring-1 ring-inset ring-brand-400/30">
            {ROLES[user.role]}
          </div>
          <div className="mt-1.5 text-sm text-slate-400">{user.email}</div>
        </div>
      </div>

      <form onSubmit={save} className="card space-y-5 p-8">
        {msg === 'ok' && <Alert tone="green">Profile updated successfully.</Alert>}
        {msg === 'err' && <Alert>Password must be at least 8 characters.</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email"><input className="input" value={user.email} disabled /></Field>
          <Field label="Role"><input className="input" value={ROLES[user.role]} disabled /></Field>
        </div>
        <Field label="Full name"><input className="input" value={f.name} onChange={set('name')} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mobile number"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
          <Field label="ID number"><input className="input" value={user.idNumber || '—'} disabled /></Field>
        </div>
        <Field label="College / Department"><select className="input" value={f.department} onChange={set('department')}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></Field>
        <Field label="New password" hint="Leave blank to keep your current password."><input type="password" className="input" value={f.password} onChange={set('password')} /></Field>
        <div className="flex justify-end"><button className="btn-primary" disabled={busy}>{busy ? <Spinner /> : 'Save changes'}</button></div>
      </form>
    </div>
  );
}
