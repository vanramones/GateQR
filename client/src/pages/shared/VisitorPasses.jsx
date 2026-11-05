import { useEffect, useState } from 'react';
import { Plus, QrCode, Ban } from 'lucide-react';
import { passStatus, VEHICLE_TYPES } from '../../lib/db';
import { Alert, Empty, Field, Modal, PageHeader, PassStatus, Spinner } from '../../components/ui';
import { VisitorPassModal } from '../../components/QRPass';
import { fmtDateTime } from '../../lib/utils';

const emptyForm = (hours) => ({ visitorName: '', contact: '', plate: '', vehicleType: 'Car', purpose: '', host: '', hours });

// Used by both the Admin (office) and Guard (gate) portals, each of which
// passes in its own independent `auth`/`api` pair so the two sessions never mix.
export default function VisitorPasses({ auth, api }) {
  const { user } = auth;
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  const [f, setF] = useState(emptyForm(4));
  const [maxHours, setMaxHours] = useState(24);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => api.listPasses().then(setList);
  useEffect(() => { load(); api.getSettings().then((s) => { setF(emptyForm(s.defaultVisitorHours)); setMaxHours(s.maxVisitorHours); }); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!/^[A-Za-z0-9 -]{4,10}$/.test(f.plate.trim())) return setErr('Enter a valid plate number.');
    setBusy(true); setErr('');
    const p = await api.issuePass(user.id, f);
    setBusy(false); setOpen(false); setF(emptyForm(f.hours)); load(); setView(p);
  };
  const revoke = async (p) => { if (confirm(`Revoke pass for ${p.visitorName}?`)) { await api.revokePass(p.id); load(); } };

  return (
    <div>
      <PageHeader title="Visitor Passes" subtitle="Issue short-term QR passes for temporary campus guests."
        action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Issue visitor pass</button>} />
      <div className="card">
        {!list.length ? <Empty title="No visitor passes" text="Issued passes will appear here." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5"><tr>{['Visitor', 'Plate', 'Purpose', 'Host', 'Valid until', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-white/5">
                {list.map((p) => (
                  <tr key={p.id} className="hover:bg-white/5">
                    <td className="td"><div className="font-medium text-white">{p.visitorName}</div><div className="text-xs text-slate-400">{p.contact}</div></td>
                    <td className="td font-mono">{p.plate}</td>
                    <td className="td">{p.purpose}</td>
                    <td className="td">{p.host}</td>
                    <td className="td whitespace-nowrap">{fmtDateTime(p.validUntil)}</td>
                    <td className="td"><PassStatus p={p} /></td>
                    <td className="td"><div className="flex justify-end gap-1">
                      <button className="btn-secondary px-2.5 py-1.5" title="View QR" onClick={() => setView(p)}><QrCode className="h-4 w-4" /></button>
                      {passStatus(p) === 'active' && <button className="btn-secondary px-2.5 py-1.5 text-red-600" title="Revoke" onClick={() => revoke(p)}><Ban className="h-4 w-4" /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Issue visitor pass" wide>
        <form onSubmit={submit} className="space-y-4">
          {err && <Alert>{err}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Visitor name"><input className="input" value={f.visitorName} onChange={set('visitorName')} required /></Field>
            <Field label="Contact number"><input className="input" value={f.contact} onChange={set('contact')} required /></Field>
            <Field label="Plate number"><input className="input uppercase" value={f.plate} onChange={set('plate')} required /></Field>
            <Field label="Vehicle type"><select className="input" value={f.vehicleType} onChange={set('vehicleType')}>{VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
            <Field label="Purpose of visit"><input className="input" value={f.purpose} onChange={set('purpose')} required /></Field>
            <Field label="Host / Office to visit"><input className="input" value={f.host} onChange={set('host')} required /></Field>
          </div>
          <Field label="Validity" hint={`Visitor passes are short-term only (maximum ${maxHours} hours).`}>
            <select className="input" value={f.hours} onChange={set('hours')}>{[2, 4, 8, 12, 24].filter((h) => h <= maxHours).map((h) => <option key={h} value={h}>{h} hours</option>)}</select>
          </Field>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? <Spinner /> : 'Generate pass'}</button></div>
        </form>
      </Modal>
      <VisitorPassModal pass={view} onClose={() => setView(null)} />
    </div>
  );
}
