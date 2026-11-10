import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { vehicleStatus, staffApi as api } from '../../lib/db';
import { Alert, PageHeader } from '../../components/ui';
import { downloadCSV, fmtDate, fmtDateTime } from '../../lib/utils';
import { useStats } from './AdminDashboard';

export const LOGO_SRC = '/images/nwssu-logo.png';
const REPORTS = { newpass: 'New Vehicle Pass', allpass: 'All Registered Vehicle Pass' };
const PASS_HEAD = ['Serial No. of Vehicle Pass', 'Name of Vehicle User', 'Official Receipt No.', 'Date & Amount'];
const isPassForm = () => true;
const CATEGORIES = { all: 'All', student: 'Student', faculty: 'Faculty', staff: 'Staff', visitor: 'Visitor' };

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');

export default function Reports() {
  const d = useStats();
  const [type, setType] = useState('newpass');
  const [category, setCategory] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [startNo, setStartNo] = useState(1);
  const [ov, setOv] = useState({});
  const [saveErr, setSaveErr] = useState('');

  const table = useMemo(() => {
    if (!d) return { head: [], rows: [] };
    const inRange = (t) => (!from || t >= new Date(from).getTime()) && (!to || t <= new Date(to).getTime() + 86399999);
    const user = (id) => d.users.find((u) => u.id === id);
    const uname = (id) => user(id)?.name || '—';
    const catOk = (role) => category === 'all' || role === category;

    {
      const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
      const approved = d.vehicles
        .filter((v) => vehicleStatus(v) !== 'pending' && vehicleStatus(v) !== 'rejected' && catOk(user(v.userId)?.role))
        .map((v) => ({ v, at: v.approvedAt || v.createdAt }))
        .sort((a, b) => a.at - b.at);
      const picked = type === 'newpass'
        ? approved.filter((x) => (from || to ? inRange(x.at) : x.at >= yearStart))
        : approved;
      const n0 = Number(startNo) || 1;
      const rows = picked.map((x, i) => {
        const v = { ...x.v, ...ov[x.v.id] };
        if (v.amountPaid === '') v.amountPaid = null;
        return [`No. ${n0 + i}`, uname(v.userId), v.orNumber || '', v.paidOn || v.amountPaid != null ? `${fmtDate(v.paidOn ? new Date(v.paidOn) : x.at)} - ${v.amountPaid != null ? `₱${Number(v.amountPaid).toFixed(2)}` : ""}` : ''];
      });
      return { form: true, head: PASS_HEAD, rows, vs: picked.map((x) => ({ ...x.v, ...ov[x.v.id] })) };
    }
  }, [d, type, category, from, to, startNo, ov]);

  const savePay = async (v, patch) => {
    const next = { ...v, ...patch };
    setOv((o) => ({ ...o, [v.id]: { ...o[v.id], ...patch } }));
    setSaveErr('');
    try { await api.updateVehicle(v.id, { remarks: next.remarks, orNumber: next.orNumber || '', amountPaid: next.amountPaid ?? '', paidOn: next.paidOn || '' }); } catch (e) { setSaveErr(e.message || 'Could not save.'); }
  };

  const summary = useMemo(() => {
    if (!d) return [];
    const g = d.logs.filter((l) => l.result === 'granted');
    return [
      ['Total vehicles', d.vehicles.length], ['Approved', d.vehicles.filter((v) => vehicleStatus(v) === 'approved').length],
      ['Pending', d.vehicles.filter((v) => vehicleStatus(v) === 'pending').length], ['Expired', d.vehicles.filter((v) => vehicleStatus(v) === 'expired').length],
      ['Total entries', g.filter((l) => l.action === 'entry').length], ['Denied attempts', d.logs.filter((l) => l.result === 'denied').length],
    ];
  }, [d]);

  if (!d) return null;
  const catLabel = category === 'all' ? '' : ` - ${CATEGORIES[category]}`;
  const period = from || to ? `${from ? fmtDate(new Date(from)) : 'Start'} to ${to ? fmtDate(new Date(to)) : 'Present'}` : 'All dates';
  const year = from ? new Date(from).getFullYear() : new Date().getFullYear();
  const title = isPassForm(type) ? `${REPORTS[type]} ${year}${catLabel}` : `NwSSU GateQR ${REPORTS[type]} Report${catLabel}`;
  const filename = `NwSSU_GateQR_${slug(REPORTS[type])}_Report${category === 'all' ? '' : `_${CATEGORIES[category]}`}_${from || 'start'}_to_${to || new Date().toISOString().slice(0, 10)}.csv`;

  return (
    <div>
      <div className="no-print">
        <PageHeader title="Reports" subtitle="Generate, print, and export system reports."
          action={<div className="flex gap-2">
            <button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</button>
            <button className="btn-primary" onClick={() => downloadCSV(filename, [['Northwest Samar State University'], [title], [`Period: ${period}`], [], table.head, ...table.rows])}><Download className="h-4 w-4" />Export CSV</button>
          </div>} />
      </div>
      <div className="no-print mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {summary.map(([k, v]) => <div key={k} className="card p-4"><div className="text-2xl font-bold text-white">{v}</div><div className="text-xs text-slate-500">{k}</div></div>)}
      </div>
      {saveErr && <div className="no-print mb-4"><Alert>{saveErr}</Alert></div>}
      <p className="no-print mb-3 text-sm text-slate-400">Type the Official Receipt No., date paid, and amount in the table below. They save automatically and appear on the printed form.</p>
      <div className="card report-doc">
        <div className="no-print flex flex-wrap items-end gap-3 border-b border-white/5 p-4">
          <div><label className="label">Report type</label><select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(REPORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="label">Report for</label><select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="label">From</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">To</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          {isPassForm(type) && <div><label className="label">Start serial no.</label><input type="number" min="1" className="input w-28" value={startNo} onChange={(e) => setStartNo(e.target.value)} /></div>}
        </div>
        <div className="report-header flex items-center gap-4 border-b border-white/5 px-4 py-4">
          <img src={LOGO_SRC} alt="NwSSU logo" className="h-16 w-16 shrink-0 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="flex-1 text-center">
            <div className="report-screen-only text-xs uppercase tracking-widest text-slate-400">Republic of the Philippines</div>
            <div className="report-screen-only text-lg font-bold text-white">Northwest Samar State University</div>
            <div className="report-sub">Auxiliary Services and Business Affairs Office</div>
            <div className="report-title font-semibold text-white">{title}</div>
            <div className="report-period text-xs text-slate-500">Period: {period} &middot; Generated {fmtDateTime(Date.now())}</div>
          </div>
          <div className="hidden h-16 w-16 shrink-0 sm:block" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5"><tr>{table.head.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/5">
              {table.rows.slice(0, table.form ? 2000 : 300).map((r, i) => {
                const v = table.vs?.[i];
                return <tr key={v?.id || i} className={table.form ? 'form-row' : ''}>{r.map((c, j) => (
                  <td key={j} className="td capitalize-none">
                    {table.form && v && j === 2 ? (<>
                      <input className="no-print input w-full py-1 text-sm" placeholder="OR No." defaultValue={v.orNumber} onBlur={(e) => e.target.value.trim() !== v.orNumber && savePay(v, { orNumber: e.target.value.trim() })} />
                      <span className="print-only">{c}</span>
                    </>) : table.form && v && j === 3 ? (<>
                      <div className="no-print flex gap-1">
                        <input type="date" className="input w-36 py-1 text-sm" defaultValue={v.paidOn} onBlur={(e) => e.target.value !== v.paidOn && savePay(v, { paidOn: e.target.value })} />
                        <input type="number" min="0" step="0.01" className="input w-24 py-1 text-sm" placeholder="Amount" defaultValue={v.amountPaid ?? ''} onBlur={(e) => e.target.value !== String(v.amountPaid ?? '') && savePay(v, { amountPaid: e.target.value })} />
                      </div>
                      <span className="print-only">{c}</span>
                    </>) : table.form ? c : (c || '—')}
                  </td>
                ))}</tr>;
              })}
              {!table.rows.length && <tr><td colSpan={table.head.length} className="td py-10 text-center text-slate-400">No records for the selected period.</td></tr>}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
