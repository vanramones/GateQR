import { useEffect, useRef, useState } from 'react';
import { UserPlus, ShieldCheck, ShieldAlert } from 'lucide-react';
import { staffApi as api, ROLES } from '../../lib/db';
import { Alert, Badge, Empty, Field, PageHeader, Spinner } from '../../components/ui';
import PasswordInput from '../auth/PasswordInput';
import { fmtDateTime } from '../../lib/utils';

const EMPTY_F = { name: '', email: '', phone: '', password: '', confirm: '', role: 'admin' };

// Lets an administrator directly create staff accounts (admins and guards)
// with their own email + password — no invite code needed. Any number of
// admins and guards can sign in at once, each with an independent session.
export default function CreateAccount() {
  const [f, setF] = useState(EMPTY_F);
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [staff, setStaff] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const formRef = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const err_ = (k) => errs[k] && <p className="mt-1 text-xs font-medium text-red-400">{errs[k]}</p>;

  const load = () => api.listUsers().then((u) => setStaff(u.filter((x) => ['admin', 'guard'].includes(x.role))));
  useEffect(() => { load(); }, []);

  const startCreate = (role) => {
    setF({ ...EMPTY_F, role });
    setErrs({}); setErr(''); setOk('');
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const validate = () => {
    const x = {};
    if (f.name.trim().length < 3) x.name = 'Enter the full name.';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) x.email = 'Enter a valid email address.';
    if (f.phone && !/^(09|\+639)\d{9}$/.test(f.phone.replace(/\s/g, ''))) x.phone = 'Use a valid PH mobile number (e.g. 09171234567).';
    if (f.password.length < 8) x.password = 'Password must be at least 8 characters.';
    if (f.password !== f.confirm) x.confirm = 'Passwords do not match.';
    setErrs(x);
    return !Object.keys(x).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    if (!validate()) return;
    setBusy(true);
    try {
      await api.createStaffAccount(f);
      setOk(`${ROLES[f.role]} account created for ${f.email.trim()}. They can sign in right away on the ${f.role === 'admin' ? 'Admin' : 'Guard'} Portal.`);
      setF(EMPTY_F); setErrs({}); setShowForm(false);
      load();
    } catch (x) { setErr(x.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title="Create Staff Account" subtitle="Directly create an administrator or gate guard account — they can sign in immediately." />

      {ok && <div className="mb-6"><Alert tone="green">{ok}</Alert></div>}

      <div className="card mb-6">
        <div className="border-b border-white/5 px-5 py-4"><h2 className="font-semibold text-white">Staff accounts</h2></div>
        {!staff.length ? <Empty title="No staff accounts yet" text="Accounts you create will appear here." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5"><tr>{['Name', 'Role', 'Contact', 'Joined', 'Status'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-white/5">
                {staff.map((u) => (
                  <tr key={u.id} className="hover:bg-white/5">
                    <td className="td"><div className="font-medium text-white">{u.name}</div><div className="text-xs text-slate-400">{u.email}</div></td>
                    <td className="td"><Badge tone={u.role === 'admin' ? 'blue' : 'amber'}>{ROLES[u.role]}</Badge></td>
                    <td className="td">{u.phone || '—'}</td>
                    <td className="td whitespace-nowrap">{fmtDateTime(u.createdAt)}</td>
                    <td className="td"><Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'active' : 'inactive'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={() => startCreate('admin')}><ShieldCheck className="h-4 w-4" />Create admin account</button>
        <button type="button" className="btn-primary" onClick={() => startCreate('guard')}><ShieldAlert className="h-4 w-4" />Create guard account</button>
      </div>

      {showForm && (
        <section ref={formRef} className="card mt-6 p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
              {f.role === 'admin' ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <h2 className="font-semibold text-white">New {f.role === 'admin' ? 'administrator' : 'gate guard'} account</h2>
          </div>
          {err && <div className="mb-4"><Alert>{err}</Alert></div>}

          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errs.name}><input className="input" placeholder="Juan Dela Cruz" value={f.name} onChange={set('name')} autoFocus /></Field>
              <Field label="Email address" error={errs.email}><input type="email" className="input" placeholder="staff@nwssu.edu.ph" value={f.email} onChange={set('email')} /></Field>
            </div>
            <Field label="Mobile number" error={errs.phone} hint="Optional."><input className="input" placeholder="09171234567" value={f.phone} onChange={set('phone')} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password" error={errs.password}><PasswordInput value={f.password} onChange={set('password')} placeholder="Create a password" /></Field>
              <Field label="Confirm password" error={errs.confirm}><PasswordInput value={f.confirm} onChange={set('confirm')} placeholder="Repeat password" /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" disabled={busy}>
                {busy ? <Spinner /> : <><UserPlus className="h-4 w-4" />Create {f.role === 'admin' ? 'administrator' : 'gate guard'} account</>}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
