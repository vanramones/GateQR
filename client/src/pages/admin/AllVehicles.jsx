import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Eye, QrCode, RefreshCw, Search, Trash2 } from 'lucide-react';
import { staffApi as api, vehicleStatus, VEHICLE_TYPES } from '../../lib/db';
import { Alert, Empty, Field, Modal, PageHeader, VehicleStatus } from '../../components/ui';
import { VehiclePassModal } from '../../components/QRPass';
import IdPreview from '../../components/IdPreview';
import { fmtDate, fmtDateTime, toLocalInput } from '../../lib/utils';

export default function AllVehicles() {
  const [vs, setVs] = useState([]);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [st, setSt] = useState('all');
  const [view, setView] = useState(null);
  const [detail, setDetail] = useState(null);
  const [edit, setEdit] = useState(null);
  const load = () => Promise.all([api.listVehicles(), api.listUsers()]).then(([v, u]) => { setVs(v); setUsers(u); });
  useEffect(() => { load(); }, []);
  const owner = (v) => users.find((u) => u.id === v.userId);

  const rows = useMemo(() => vs.filter((v) => (st === 'all' || vehicleStatus(v) === st) && (!q || `${v.plate} ${v.make} ${v.model} ${owner(v)?.name}`.toLowerCase().includes(q.toLowerCase()))), [vs, q, st, users]);
  const renew = async (v) => { await api.renewVehicle(v.id); load(); };
  const remove = async (v) => { if (confirm(`Permanently delete ${v.plate} from the registry?`)) { await api.deleteVehicle(v.id); setDetail(null); load(); } };

  const togglePass = async (v) => { await api.updateVehicle(v.id, { passEnabled: !v.passEnabled }); setDetail((d) => d && d.id === v.id ? { ...d, passEnabled: !v.passEnabled } : d); load(); };
  const startEdit = (v) => setEdit({ ...v, validUntilInput: toLocalInput(v.validUntil) });
  const saveEdit = async (e) => {
    e.preventDefault();
    const { id, type, plate, make, model, color, year, orcrNo, licenseNo, licenseExpiry, remarks, validUntilInput, accessStart, accessEnd } = edit;
    if (!!accessStart !== !!accessEnd) { alert('Set both a start and end time for the daily pass hours, or leave both empty.'); return; }
    await api.updateVehicle(id, { type, plate: plate.trim().toUpperCase(), make, model, color, year, orcrNo, licenseNo, licenseExpiry, remarks, accessStart, accessEnd, ...(validUntilInput ? { validUntil: new Date(validUntilInput).getTime() } : {}) });
    setEdit(null); setDetail(null); load();
  };

  return (
    <div>
      <PageHeader title="All Vehicles" subtitle="Central record of every registered vehicle." />
      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-white/5 p-4">
          <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Search plate, vehicle, or owner..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input w-auto" value={st} onChange={(e) => setSt(e.target.value)}>{['all', 'approved', 'pending', 'rejected', 'expired'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s[0].toUpperCase() + s.slice(1)}</option>)}</select>
        </div>
        {!rows.length ? <Empty title="No vehicles found" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5"><tr>{['Plate', 'Vehicle', 'Owner', 'Type', 'Valid until', 'Status', ''].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((v) => (
                  <tr key={v.id} className="cursor-pointer hover:bg-white/5" onClick={() => setDetail(v)}>
                    <td className="td font-mono font-semibold text-white">{v.plate}</td>
                    <td className="td">{v.make} {v.model}<div className="text-xs text-slate-400">{v.color}, {v.year}</div></td>
                    <td className="td">{owner(v)?.name}<div className="text-xs capitalize text-slate-400">{owner(v)?.role}</div></td>
                    <td className="td">{v.type}</td>
                    <td className="td whitespace-nowrap">{fmtDate(v.validUntil)}</td>
                    <td className="td"><VehicleStatus v={v} /></td>
                    <td className="td" onClick={(e) => e.stopPropagation()}><div className="flex justify-end gap-1">
                      <button className="btn-secondary px-2.5 py-1.5" title="View details" onClick={() => setDetail(v)}><Eye className="h-4 w-4" /></button>
                      {vehicleStatus(v) === 'approved' && <button className="btn-secondary px-2.5 py-1.5" title="View QR" onClick={() => setView(v)}><QrCode className="h-4 w-4" /></button>}
                      {vehicleStatus(v) === 'approved' && <button className={`btn-secondary px-2.5 py-1.5 ${v.passEnabled ? 'text-red-600' : 'text-emerald-500'}`} title={v.passEnabled ? 'Disable QR pass' : 'Enable QR pass'} onClick={() => togglePass(v)}>{v.passEnabled ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</button>}
                      {vehicleStatus(v) === 'expired' && <button className="btn-secondary px-2.5 py-1.5" title="Renew 12 months" onClick={() => renew(v)}><RefreshCw className="h-4 w-4" /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <VehiclePassModal vehicle={view} owner={view && owner(view)} onClose={() => setView(null)} />

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Vehicle details - ${detail?.plate || ''}`} wide>
        {detail && !edit && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div><div className="text-xl font-bold tracking-wide text-white">{detail.plate}</div><div className="text-sm text-slate-500">{detail.make} {detail.model} &middot; {detail.color} &middot; {detail.year}</div></div>
              <VehicleStatus v={detail} />
            </div>
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-white/5 p-4 text-sm sm:grid-cols-3">
              <div><div className="text-xs text-slate-400">Owner</div><div className="font-medium">{owner(detail)?.name}</div></div>
              <div><div className="text-xs text-slate-400">Role / ID</div><div className="font-medium capitalize">{owner(detail)?.role} &middot; {owner(detail)?.idNumber || '—'}</div></div>
              <div><div className="text-xs text-slate-400">Contact</div><div className="font-medium">{owner(detail)?.phone || '—'}</div></div>
              <div><div className="text-xs text-slate-400">OR/CR no.</div><div className="font-medium">{detail.orcrNo}</div></div>
              <div><div className="text-xs text-slate-400">License no.</div><div className="font-medium">{detail.licenseNo}</div></div>
              <div><div className="text-xs text-slate-400">License expiry</div><div className="font-medium">{detail.licenseExpiry}</div></div>
              <div><div className="text-xs text-slate-400">Submitted</div><div className="font-medium">{fmtDateTime(detail.createdAt)}</div></div>
              <div><div className="text-xs text-slate-400">Approved</div><div className="font-medium">{fmtDate(detail.approvedAt)}</div></div>
              <div><div className="text-xs text-slate-400">Valid until</div><div className="font-medium">{fmtDateTime(detail.validUntil)}</div></div>
              <div><div className="text-xs text-slate-400">Daily pass hours</div><div className="font-medium">{detail.accessStart && detail.accessEnd ? `${detail.accessStart} – ${detail.accessEnd}` : 'Any time'}</div></div>
              <div><div className="text-xs text-slate-400">QR pass</div><div className="font-medium">{detail.passEnabled ? 'Enabled' : 'Disabled'}</div></div>
            </div>
            <IdPreview frontPath={detail.idFrontPath} backPath={detail.idBackPath} selfiePath={detail.selfiePath} vehiclePhotoPath={detail.vehiclePhotoPath} vehicleFrontPath={detail.vehicleFrontPath} vehicleSidePath={detail.vehicleSidePath} vehicleBackPath={detail.vehicleBackPath} proofPath={detail.proofDocPath} receiptPath={detail.paymentReceiptPath} />
            {detail.remarks && <Alert tone="amber">{detail.remarks}</Alert>}
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn-danger" onClick={() => remove(detail)}><Trash2 className="h-4 w-4" />Delete record</button>
              {vehicleStatus(detail) === 'expired' && <button className="btn-secondary" onClick={() => renew(detail)}><RefreshCw className="h-4 w-4" />Renew 12 months</button>}
              {vehicleStatus(detail) === 'approved' && <button className="btn-secondary" onClick={() => togglePass(detail)}>{detail.passEnabled ? <><Ban className="h-4 w-4" />Disable QR pass</> : <><CheckCircle2 className="h-4 w-4" />Enable QR pass</>}</button>}
              {vehicleStatus(detail) === 'approved' && <button className="btn-secondary" onClick={() => setView(detail)}><QrCode className="h-4 w-4" />View QR pass</button>}
              <button className="btn-primary" onClick={() => startEdit(detail)}>Edit details</button>
            </div>
          </div>
        )}
        {edit && (
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Vehicle type"><select className="input" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>{VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label="Plate number"><input className="input uppercase" value={edit.plate} onChange={(e) => setEdit({ ...edit, plate: e.target.value })} required /></Field>
              <Field label="Make"><input className="input" value={edit.make} onChange={(e) => setEdit({ ...edit, make: e.target.value })} required /></Field>
              <Field label="Model"><input className="input" value={edit.model} onChange={(e) => setEdit({ ...edit, model: e.target.value })} required /></Field>
              <Field label="Color"><input className="input" value={edit.color} onChange={(e) => setEdit({ ...edit, color: e.target.value })} required /></Field>
              <Field label="Year"><input className="input" value={edit.year} onChange={(e) => setEdit({ ...edit, year: e.target.value })} required /></Field>
              <Field label="OR/CR number"><input className="input" value={edit.orcrNo} onChange={(e) => setEdit({ ...edit, orcrNo: e.target.value })} required /></Field>
              <Field label="License number"><input className="input" value={edit.licenseNo} onChange={(e) => setEdit({ ...edit, licenseNo: e.target.value })} required /></Field>
              <Field label="License expiry"><input type="date" className="input" value={edit.licenseExpiry} onChange={(e) => setEdit({ ...edit, licenseExpiry: e.target.value })} required /></Field>
              <Field label="Pass expires (date & time)"><input type="datetime-local" className="input" value={edit.validUntilInput} onChange={(e) => setEdit({ ...edit, validUntilInput: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Daily hours from"><input type="time" className="input" value={edit.accessStart} onChange={(e) => setEdit({ ...edit, accessStart: e.target.value })} /></Field>
                <Field label="to"><input type="time" className="input" value={edit.accessEnd} onChange={(e) => setEdit({ ...edit, accessEnd: e.target.value })} /></Field>
              </div>
            </div>
            <Field label="Remarks (visible to owner)"><textarea className="input min-h-[80px]" value={edit.remarks || ''} onChange={(e) => setEdit({ ...edit, remarks: e.target.value })} /></Field>
            <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary">Save changes</button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
