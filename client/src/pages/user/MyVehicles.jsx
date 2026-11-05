import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, QrCode, RefreshCw, Trash2, Bike, Car as CarIcon, Mail } from 'lucide-react';
import { useUserAuth } from '../../context/AuthContext';
import { userApi as api, vehicleStatus } from '../../lib/db';
import { Empty, PageHeader, VehicleStatus } from '../../components/ui';
import { VehiclePassModal } from '../../components/QRPass';
import FileUpload from '../../components/FileUpload';
import { fmtDate } from '../../lib/utils';

function PaymentSection({ v, userId, onUploaded }) {
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!v.paymentNoticeSentAt) {
    return <div className="flex-1 rounded-lg bg-amber-500/10 px-3 py-2.5 text-center text-sm text-amber-300">Awaiting admin review</div>;
  }

  if (v.paymentReceiptPath) {
    return <div className="flex-1 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-center text-sm text-emerald-300">Receipt submitted &mdash; awaiting final approval</div>;
  }

  const upload = async () => {
    if (!doc) return;
    setBusy(true); setErr('');
    try { await api.uploadPaymentReceipt(v.id, userId, doc); onUploaded(); } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };

  return (
    <div className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300"><Mail className="h-4 w-4" />Payment instructions sent to your email</div>
      <p className="mb-2 text-xs text-amber-200/80">Please pay at the NWSSU Cashier, then upload a photo or PDF of your official receipt below so the administrator can approve your QR pass.</p>
      <FileUpload label="Payment receipt" camera={false} dropHint="Upload a clear photo or PDF of your official receipt." value={doc} error={err} onChange={(d, fe) => { setDoc(d); setErr(fe || ''); }} />
      {doc && <button type="button" className="btn-primary mt-2 w-full" disabled={busy} onClick={upload}>{busy ? 'Uploading…' : 'Submit receipt'}</button>}
    </div>
  );
}

export default function MyVehicles() {
  const { user } = useUserAuth();
  const [list, setList] = useState(null);
  const [view, setView] = useState(null);
  const load = () => api.listVehicles(user.id).then(setList);
  useEffect(() => { load(); }, []);

  const renew = async (v) => { await api.updateVehicle(v.id, { status: 'pending', validUntil: null, remarks: 'Renewal requested' }); load(); };
  const remove = async (v) => { if (confirm(`Delete ${v.plate}? This cannot be undone.`)) { await api.deleteVehicle(v.id); load(); } };

  return (
    <div>
      <PageHeader title="My Vehicles" subtitle="View your registered vehicles and their QR passes."
        action={<Link to="/app/register" className="btn-primary"><Plus className="h-4 w-4" />Register vehicle</Link>} />
      {list && !list.length && (
        <div className="card"><Empty title="No vehicles registered" text="Register your first vehicle to receive a QR pass.">
          <Link to="/app/register" className="btn-primary"><Plus className="h-4 w-4" />Register vehicle</Link></Empty></div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list?.map((v) => {
          const st = vehicleStatus(v);
          return (
            <div key={v.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{['Motorcycle', 'Bicycle', 'Tricycle'].includes(v.type) ? <Bike className="h-6 w-6" /> : <CarIcon className="h-6 w-6" />}</div>
                  <div><div className="text-lg font-bold tracking-wide text-white">{v.plate}</div><div className="text-sm text-slate-500">{v.make} {v.model}</div></div>
                </div>
                <VehicleStatus v={v} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-slate-400">Type</dt><dd className="font-medium">{v.type}</dd></div>
                <div><dt className="text-xs text-slate-400">Color / Year</dt><dd className="font-medium">{v.color} / {v.year}</dd></div>
                <div><dt className="text-xs text-slate-400">Submitted</dt><dd className="font-medium">{fmtDate(v.createdAt)}</dd></div>
                <div><dt className="text-xs text-slate-400">Valid until</dt><dd className="font-medium">{fmtDate(v.validUntil)}</dd></div>
              </dl>
              {st === 'rejected' && v.remarks && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"><b>Reason:</b> {v.remarks}</p>}
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {st === 'approved' && <button className="btn-primary flex-1" onClick={() => setView(v)}><QrCode className="h-4 w-4" />View QR pass</button>}
                {st === 'expired' && <button className="btn-primary flex-1" onClick={() => renew(v)}><RefreshCw className="h-4 w-4" />Request renewal</button>}
                {st === 'pending' && <PaymentSection v={v} userId={user.id} onUploaded={load} />}
                {st === 'rejected' && <Link to="/app/register" className="btn-secondary flex-1">Re-submit</Link>}
                {st !== 'approved' && <button className="btn-secondary px-3 text-red-600" onClick={() => remove(v)} title="Delete"><Trash2 className="h-4 w-4" /></button>}
              </div>
            </div>
          );
        })}
      </div>
      <VehiclePassModal vehicle={view} owner={user} onClose={() => setView(null)} />
    </div>
  );
}
