import { useEffect, useState } from 'react';
import { Check, X, Mail, Clock, FileCheck2, Eye } from 'lucide-react';
import { staffApi as api, vehicleStatus } from '../../lib/db';
import { Alert, DocViewer, Empty, Field, Modal, PageHeader, Spinner } from '../../components/ui';
import IdPreview from '../../components/IdPreview';
import { fmtDateTime } from '../../lib/utils';

export default function Registrations() {
  const [vs, setVs] = useState([]);
  const [users, setUsers] = useState([]);
  const [rej, setRej] = useState(null);
  const [reason, setReason] = useState('');
  const [months, setMonths] = useState(12);
  const [until, setUntil] = useState('');
  const [accessStart, setAccessStart] = useState('');
  const [accessEnd, setAccessEnd] = useState('');
  const [sendingId, setSendingId] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [err, setErr] = useState('');
  const [pay, setPay] = useState({});
  const today = new Date().toISOString().slice(0, 10);
  const setP = (id, k, val) => setPay((s) => ({ ...s, [id]: { ...s[id], [k]: val } }));
  const load = () => Promise.all([api.listVehicles(), api.listUsers()]).then(([v, u]) => { setVs(v.filter((x) => vehicleStatus(x) === 'pending')); setUsers(u); });
  useEffect(() => {
    load();
    api.getSettings().then((s) => setMonths(s.defaultValidityMonths));
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  // Notify the owner in-app and by email after a decision. A notification
  // failure must not undo the decision itself, so errors only surface a warning.
  const notify = async (v, o, decision, remarks = '', validUntil = null) => {
    try {
      const title = decision === 'approved' ? `Vehicle registration approved - ${v.plate}` : `Vehicle registration rejected - ${v.plate}`;
      const body = decision === 'approved'
        ? `Your ${v.make} ${v.model} (${v.plate}) was approved. Your QR gate pass is now active.`
        : `Your ${v.make} ${v.model} (${v.plate}) was not approved. Reason: ${remarks}`;
      await api.notifyUser(v.userId, title, body);
      if (o?.email) await api.sendStatusNotice({ ...v, validUntil }, o, decision, remarks);
    } catch (x) { setErr(`Decision saved, but the owner could not be notified: ${x.message}`); }
  };

  const approve = async (v) => {
    if (!v.paymentReceiptPath) return;
    setErr('');
    if ((accessStart && !accessEnd) || (!accessStart && accessEnd)) { setErr('Set both a start and end time for the daily pass hours, or leave both empty.'); return; }
    const validUntil = until ? new Date(until).getTime() : null;
    if (validUntil && validUntil <= Date.now()) { setErr('The expiry date/time must be in the future.'); return; }
    const p = pay[v.id] || {};
    if (!p.orNumber?.trim() || !p.amountPaid) { setErr(`Enter the Official Receipt No. and amount paid for ${v.plate} (as written on the cashier receipt) before approving.`); return; }
    try {
      await api.reviewVehicle(v.id, 'approved', '', months, { validUntil, accessStart, accessEnd, orNumber: p.orNumber, amountPaid: p.amountPaid, paidOn: p.paidOn || today });
    } catch (x) { setErr(`Could not approve ${v.plate}: ${x.message}`); return; }
    const o = users.find((u) => u.id === v.userId);
    await notify(v, o, 'approved', '', validUntil || Date.now() + months * 30 * 86400000);
    load();
  };
  const reject = async () => {
    setErr('');
    const remarks = reason || 'Does not meet requirements.';
    try {
      await api.reviewVehicle(rej.id, 'rejected', remarks);
    } catch (x) { setErr(`Could not reject ${rej.plate}: ${x.message}`); return; }
    const o = users.find((u) => u.id === rej.userId);
    await notify(rej, o, 'rejected', remarks);
    setRej(null); setReason(''); load();
  };

  const sendNotice = async (v, o) => {
    setErr(''); setSendingId(v.id);
    try { await api.sendPaymentNotice(v, o); load(); } catch (x) { setErr(x.message); } finally { setSendingId(null); }
  };

  // Preview the uploaded cashier receipt in-page so the admin can inspect
  // whether it looks genuine before approving.
  const viewReceipt = async (v) => {
    try {
      const urls = await api.getIdSignedUrls(v);
      if (urls.receipt) setViewer({ url: urls.receipt, label: `Payment receipt — ${v.plate}`, isPdf: v.paymentReceiptPath.toLowerCase().endsWith('.pdf') });
    } catch (x) { setErr(x.message); }
  };

  return (
    <div>
      <PageHeader title="Registration Requests" subtitle="Review and approve vehicle registrations. Approved vehicles receive an active QR pass."
        action={<div className="flex flex-wrap items-center gap-2 text-sm"><span className="text-slate-500">Pass validity</span>
          <select className="input w-auto" value={months} onChange={(e) => { setMonths(Number(e.target.value)); setUntil(''); }}>{[6, 12, 24].map((m) => <option key={m} value={m}>{m} months</option>)}</select>
          <span className="text-slate-500">or expires</span>
          <input type="datetime-local" className="input w-auto" value={until} onChange={(e) => setUntil(e.target.value)} />
          <span className="text-slate-500">Daily hours</span>
          <input type="time" className="input w-auto" value={accessStart} onChange={(e) => setAccessStart(e.target.value)} />
          <span className="text-slate-500">to</span>
          <input type="time" className="input w-auto" value={accessEnd} onChange={(e) => setAccessEnd(e.target.value)} /></div>} />
      {err && <div className="mb-4"><Alert>{err}</Alert></div>}
      {!vs.length ? <div className="card"><Empty title="No pending requests" text="New registrations awaiting review will appear here." /></div> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {vs.map((v) => {
            const o = users.find((u) => u.id === v.userId);
            const p = pay[v.id] || {};
            const canApprove = !!v.paymentReceiptPath && !!p.orNumber?.trim() && !!p.amountPaid;
            return (
              <div key={v.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div><div className="text-lg font-bold tracking-wide text-white">{v.plate}</div><div className="text-sm text-slate-500">{v.type} &middot; {v.make} {v.model} &middot; {v.color} &middot; {v.year}</div></div>
                  <span className="whitespace-nowrap text-xs text-slate-400">{fmtDateTime(v.createdAt)}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-white/5 p-3 text-sm">
                  <div><div className="text-xs text-slate-400">Owner</div><div className="font-medium">{o?.name}</div></div>
                  <div><div className="text-xs text-slate-400">Role / ID</div><div className="font-medium capitalize">{o?.role} &middot; {o?.idNumber}</div></div>
                  <div><div className="text-xs text-slate-400">OR/CR no.</div><div className="font-medium">{v.orcrNo}</div></div>
                  <div><div className="text-xs text-slate-400">License / Expiry</div><div className="font-medium">{v.licenseNo} &middot; {v.licenseExpiry}</div></div>
                </div>
                <div className="mt-3"><IdPreview frontPath={v.idFrontPath} backPath={v.idBackPath} selfiePath={v.selfiePath} vehiclePhotoPath={v.vehiclePhotoPath} vehicleFrontPath={v.vehicleFrontPath} vehicleSidePath={v.vehicleSidePath} vehicleBackPath={v.vehicleBackPath} proofPath={v.proofDocPath} receiptPath={v.paymentReceiptPath} /></div>

                <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                  {!v.paymentNoticeSentAt ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-slate-400"><Mail className="h-4 w-4" />No payment notice sent yet.</div>
                      <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={sendingId === v.id} onClick={() => sendNotice(v, o)}>
                        {sendingId === v.id ? <Spinner /> : <Mail className="h-3.5 w-3.5" />}Send payment notice
                      </button>
                    </div>
                  ) : v.paymentReceiptPath ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-emerald-400"><FileCheck2 className="h-4 w-4" />Payment receipt received &mdash; review before approving.</div>
                      <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => viewReceipt(v)}>
                        <Eye className="h-3.5 w-3.5" />View receipt
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-amber-400"><Clock className="h-4 w-4" />Payment notice sent {fmtDateTime(v.paymentNoticeSentAt)} &middot; waiting for receipt.</div>
                      <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={sendingId === v.id} onClick={() => sendNotice(v, o)}>
                        {sendingId === v.id ? <Spinner /> : <Mail className="h-3.5 w-3.5" />}Resend
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Field label="Official Receipt No."><input className="input" placeholder="e.g. 9754917" value={pay[v.id]?.orNumber || ''} onChange={(e) => setP(v.id, 'orNumber', e.target.value)} /></Field>
                  <Field label="Amount paid"><input type="number" min="0" step="0.01" className="input" placeholder="50.00" value={pay[v.id]?.amountPaid || ''} onChange={(e) => setP(v.id, 'amountPaid', e.target.value)} /></Field>
                  <Field label="Date paid"><input type="date" className="input" value={pay[v.id]?.paidOn || today} onChange={(e) => setP(v.id, 'paidOn', e.target.value)} /></Field>
                </div>

                <div className="mt-4 flex gap-2">
                  <button className="btn-success flex-1" disabled={!canApprove} title={canApprove ? 'Approve this registration' : !v.paymentReceiptPath ? 'Approve is enabled once the owner uploads the payment receipt' : 'Enter the Official Receipt No. and amount paid before approving'} onClick={() => approve(v)}><Check className="h-4 w-4" />Approve</button>
                  <button className="btn-secondary flex-1 text-red-600" onClick={() => setRej(v)}><X className="h-4 w-4" />Reject</button>
                </div>
                {!v.paymentReceiptPath ? (
                  <p className="mt-2 text-center text-xs text-slate-500">Approve is enabled once the owner uploads the payment receipt.</p>
                ) : !canApprove && (
                  <p className="mt-2 text-center text-xs text-slate-500">Approve is enabled once you enter the Official Receipt No. and amount paid.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      <DocViewer doc={viewer} onClose={() => setViewer(null)} />
      <Modal open={!!rej} onClose={() => setRej(null)} title={`Reject ${rej?.plate}`}>
        <Field label="Reason for rejection" hint="This will be shown to the vehicle owner.">
          <textarea className="input min-h-[100px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. OR/CR number does not match the plate number." />
        </Field>
        <div className="mt-4 flex justify-end gap-2"><button className="btn-secondary" onClick={() => setRej(null)}>Cancel</button><button className="btn-danger" onClick={reject}>Reject registration</button></div>
      </Modal>
    </div>
  );
}
