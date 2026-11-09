import { useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, Plus, Search } from 'lucide-react';
import { staffApi as api, ROLES } from '../../lib/db';
import { Alert, Badge, Field, Modal, PageHeader } from '../../components/ui';
import { fmtDateTime } from '../../lib/utils';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [open, setOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState('guard');
  const [newCode, setNewCode] = useState('');
  const [err, setErr] = useState('');
  const load = () => { api.listUsers().then(setUsers); api.listStaffInvites().then(setInvites); };
  useEffect(() => { load(); }, []);

  const rows = useMemo(() => users.filter((u) => (role === 'all' || u.role === role) && (!q || `${u.name} ${u.email} ${u.idNumber}`.toLowerCase().includes(q.toLowerCase()))), [users, q, role]);

  const generate = async () => {
    setErr('');
    try { setNewCode(await api.createStaffInvite(inviteRole)); load(); } catch (x) { setErr(x.message); }
  };
  const toggle = async (u) => { await api.setUserActive(u.id, !u.active); load(); };
  const togglePass = async (u) => { try { await api.setUserPassEnabled(u.id, !u.passEnabled); load(); } catch (x) { setErr(x.message); } };
  const changeRole = async (u, newRole) => { try { await api.setUserRole(u.id, newRole); load(); } catch (x) { setErr(x.message); } };
  const copy = (code) => navigator.clipboard?.writeText(code);

  return (
    <div>
      <PageHeader title="Users" subtitle="Manage accounts for the university community, gate guards, and administrators."
        action={<button className="btn-primary" onClick={() => { setOpen(true); setNewCode(''); setErr(''); }}><Plus className="h-4 w-4" />Invite guard / admin</button>} />

      {err && <div className="mb-4"><Alert>{err}</Alert></div>}

      <div className="card mb-6">
        <div className="flex flex-wrap gap-3 border-b border-white/5 p-4">
          <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Search name, email, or ID..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value)}><option value="all">All roles</option>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5"><tr>{['Name', 'Role', 'ID number', 'Contact', 'Joined', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-white/5">
                  <td className="td"><div className="font-medium text-white">{u.name}</div><div className="text-xs text-slate-400">{u.email}</div></td>
                  <td className="td">
                    {['admin', 'guard'].includes(u.role) ? (
                      <Badge tone={u.role === 'admin' ? 'blue' : 'amber'}>{ROLES[u.role]}</Badge>
                    ) : (
                      <select className="input w-auto py-1.5 text-xs" value={u.role} onChange={(e) => changeRole(u, e.target.value)} title="Community role — faculty accounts can register up to 5 vehicles">
                        <option value="student">Student</option>
                        <option value="faculty">Faculty</option>
                        <option value="staff">Staff</option>
                      </select>
                    )}
                  </td>
                  <td className="td">{u.idNumber || '—'}</td>
                  <td className="td">{u.phone || '—'}</td>
                  <td className="td whitespace-nowrap">{fmtDateTime(u.createdAt)}</td>
                  <td className="td"><Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'active' : 'inactive'}</Badge>{!['admin', 'guard'].includes(u.role) && !u.passEnabled && <div className="mt-1"><Badge tone="amber">QR pass disabled</Badge></div>}</td>
                  <td className="td text-right"><div className="flex justify-end gap-2">
                    {!['admin', 'guard'].includes(u.role) && <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => togglePass(u)}>{u.passEnabled ? 'Disable QR pass' : 'Enable QR pass'}</button>}
                    <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => toggle(u)}>{u.active ? 'Deactivate' : 'Activate'}</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-white/5 px-5 py-4"><h2 className="font-semibold text-white">Staff invite codes</h2><p className="text-sm text-slate-500">Generated codes let a new guard or admin create their own account via the Staff Sign-up page.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5"><tr>{['Code', 'Role', 'Issued', 'Status'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/5">
              {invites.map((i) => (
                <tr key={i.code}>
                  <td className="td font-mono font-semibold tracking-widest">{i.code}</td>
                  <td className="td"><Badge tone={i.role === 'admin' ? 'blue' : 'amber'}>{ROLES[i.role]}</Badge></td>
                  <td className="td whitespace-nowrap">{fmtDateTime(i.createdAt)}</td>
                  <td className="td">{i.redeemedAt ? <Badge tone="slate">Redeemed {fmtDateTime(i.redeemedAt)}</Badge> : <Badge tone="green">Available</Badge>}</td>
                </tr>
              ))}
              {!invites.length && <tr><td colSpan={4} className="td py-8 text-center text-slate-400">No invite codes issued yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Invite a staff member">
        {err && <div className="mb-4"><Alert>{err}</Alert></div>}
        {!newCode ? (
          <div className="space-y-4">
            <Field label="Role" hint="The invited person will sign up themselves using this code.">
              <select className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}><option value="guard">Gate Guard</option><option value="admin">Administrator</option></select>
            </Field>
            <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" onClick={generate}><KeyRound className="h-4 w-4" />Generate invite code</button></div>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-500">Share this one-time code with the new {ROLES[inviteRole].toLowerCase()}. They will enter it on the {inviteRole === 'admin' ? 'Admin' : 'Guard'} Sign-up page (<span className="font-mono">{inviteRole === 'admin' ? '/admin/register' : '/guard/register'}</span>) to create their account.</p>
            <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 py-6">
              <span className="font-mono text-3xl font-bold tracking-[0.3em] text-brand-700">{newCode}</span>
              <button type="button" className="rounded-lg p-2 text-brand-600 hover:bg-brand-100" onClick={() => copy(newCode)} title="Copy"><Copy className="h-5 w-5" /></button>
            </div>
            <button className="btn-primary w-full" onClick={() => setOpen(false)}>Done</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
