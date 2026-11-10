import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { vehicleStatus, passStatus, ROLES } from '../../lib/db';
import { PageHeader } from '../../components/ui';
import { downloadCSV, fmtDate, fmtDateTime, fmtTime } from '../../lib/utils';
import { useStats } from './AdminDashboard';

export const LOGO_SRC = '/images/nwssu-logo.jpg';
const REPORTS = { vehicles: 'Vehicle Registry', logs: 'Vehicle Entry Activity', visitors: 'Visitor Vehicle Pass', users: 'Vehicle Pass User Report', newpass: 'New Vehicle Pass', allpass: 'All Registered Vehicle Pass' };
const PASS_FEE = 50;
const PASS_HEAD = ['Serial No. of Vehicle Pass', 'Name of Vehicle User', 'Official Receipt No.', 'Date & Amount'];
const isPassForm = (t) => t === 'newpass' || t === 'allpass';
const CATEGORIES = { all: 'All', student: 'Student', faculty: 'Faculty', staff: 'Staff', visitor: 'Visitor' };

const dayKey = (t) => new Date(t).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

const validity = (l, vById, pById) => {
  if (l.type === 'vehicle') {
    const v = vById[l.refId];
    return v ? `${vehicleStatus(v) === 'expired' ? 'Expired' : v.passEnabled ? 'Valid' : 'Disabled'} (until ${fmtDate(v.validUntil)})` : '—';
  }
  const p = pById[l.refId];
  return p ? `${passStatus(p) === 'expired' ? 'Expired' : passStatus(p) === 'revoked' ? 'Revoked' : 'Valid'} (until ${fmtDateTime(p.validUntil)})` : '—';
};

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');

export default function Reports() {
  const d = useStats();
  const [type, setType] = useState('newpass');
  const [category, setCategory] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [startNo, setStartNo] = useState(1);

  const table = useMemo(() => {
    if (!d) return { head: [], rows: [] };
    const inRange = (t) => (!from || t >= new Date(from).getTime()) && (!to || t <= new Date(to).getTime() + 86399999);
    const user = (id) => d.users.find((u) => u.id === id);
    const uname = (id) => user(id)?.name || '—';
    const catOk = (role) => category === 'all' || role === category;

    if (isPassForm(type)) {
      const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
      const approved = d.vehicles
        .filter((v) => vehicleStatus(v) !== 'pending' && vehicleStatus(v) !== 'rejected' && catOk(user(v.userId)?.role))
        .map((v) => ({ v, at: v.approvedAt || v.createdAt }))
        .sort((a, b) => a.at - b.at);
      const picked = type === 'newpass'
        ? approved.filter((x) => (from || to ? inRange(x.at) : x.at >= yearStart))
        : approved;
      const n0 = Number(startNo) || 1;
      // Same data as the payment-notice email's receipt: its "No." is the plate,
      // dated the day the notice was sent, amount = registration fee..
      const eff = (x) => {
        const v = x.v;
        return { ...v, orNumber: v.plate, paidOn: new Date(v.paymentNoticeSentAt || x.at).toISOString().slice(0, 10), amountPaid: PASS_FEE };
      };
      const vs = picked.map(eff);
      const rows = vs.map((v, i) => [`No. ${n0 + i}`, uname(v.userId), v.orNumber, `${fmtDate(new Date(v.paidOn))} - ₱${Number(v.amountPaid).toFixed(2)}`]);
      return { form: true, head: PASS_HEAD, rows, vs };
    }
    if (type === 'vehicles') {
      return { head: ['No.', 'Plate', 'Type', 'Vehicle', 'Owner', 'Role', 'Status', 'QR Pass', 'Valid until'], rows: d.vehicles.filter((v) => inRange(v.createdAt) && catOk(user(v.userId)?.role)).map((v, i) => [i + 1, v.plate, v.type, `${v.make} ${v.model}`, uname(v.userId), ROLES[user(v.userId)?.role], vehicleStatus(v), v.passEnabled ? 'Enabled' : 'Disabled', fmtDateTime(v.validUntil)]) };
    }
    if (type === 'logs') {
      const vById = Object.fromEntries(d.vehicles.map((v) => [v.id, v]));
      const pById = Object.fromEntries(d.passes.map((p) => [p.id, p]));
      const guard = (id) => uname(id);
      const granted = d.logs.filter((l) => l.result === 'granted').sort((a, b) => a.timestamp - b.timestamp);
      const open = {};
      const sessions = [];
      for (const l of granted) {
        const key = l.refId || l.plate;
        if (l.action === 'entry') {
          const s = { log: l, inAt: l.timestamp, outAt: null, guardIn: l.guardId, guardOut: null };
          sessions.push(s); open[key] = s;
        } else if (open[key]) {
          open[key].outAt = l.timestamp; open[key].guardOut = l.guardId; delete open[key];
        } else sessions.push({ log: l, inAt: null, outAt: l.timestamp, guardIn: null, guardOut: l.guardId });
      }
      const rows = sessions
        .map((s) => {
          const l = s.log;
          const owner = l.type === 'vehicle' ? user(vById[l.refId]?.userId) : null;
          const role = l.type === 'visitor' ? 'visitor' : owner?.role;
          return { s, l, owner, role, ref: s.inAt || s.outAt };
        })
        .filter((x) => inRange(x.ref) && catOk(x.role))
        .sort((a, b) => b.ref - a.ref)
        .map((x, i) => [i + 1, dayKey(x.ref), x.l.name || x.owner?.name || pById[x.l.refId]?.visitorName, x.role ? (x.role === 'visitor' ? 'Visitor' : ROLES[x.role]) : '—', x.owner?.idNumber || '—', x.l.plate, x.s.inAt ? fmtTime(x.s.inAt) : '—', x.s.outAt ? fmtTime(x.s.outAt) : '—', validity(x.l, vById, pById), guard(x.s.guardIn || x.s.guardOut)]);
      return { head: ['No.', 'Date', 'Name', 'Role', 'ID No.', 'Plate No.', 'Entry', 'Exit', 'Validity', 'Guard on Duty'], rows };
    }
    if (type === 'visitors') {
      if (category !== 'all' && category !== 'visitor') return { head: ['No.', 'Visitor', 'Plate', 'Purpose', 'Host', 'Issued', 'Valid until', 'Status'], rows: [] };
      return { head: ['No.', 'Visitor', 'Plate', 'Purpose', 'Host', 'Issued', 'Valid until', 'Status'], rows: d.passes.filter((p) => inRange(p.createdAt)).map((p, i) => [i + 1, p.visitorName, p.plate, p.purpose, p.host, fmtDateTime(p.createdAt), fmtDateTime(p.validUntil), passStatus(p)]) };
    }
    return { head: ['No.', 'Name', 'Role', 'ID number', 'Department', 'Email', 'Joined'], rows: d.users.filter((u) => inRange(u.createdAt) && catOk(u.role)).map((u, i) => [i + 1, u.name, ROLES[u.role], u.idNumber, u.department, u.email, fmtDate(u.createdAt)]) };
  }, [d, type, category, from, to, startNo]);


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
      <div className="card report-doc">
        <div className="no-print flex flex-wrap items-end gap-3 border-b border-white/5 p-4">
          <div><label className="label">Report type</label><select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(REPORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="label">Report for</label><select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="label">From</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">To</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          {isPassForm(type) && <div><label className="label">Start serial no.</label><input type="number" min="1" className="input w-28" value={startNo} onChange={(e) => setStartNo(e.target.value)} /></div>}
        </div>
        <div className="report-header flex items-center gap-4 border-b border-white/5 px-4 py-4">
          <img src={LOGO_SRC} alt="NwSSU logo" className="h-20 w-20 shrink-0 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="flex-1 text-center">
            <div className="report-republic text-xs uppercase tracking-widest text-slate-400">Republic of the Philippines</div>
            <div className="report-univ text-lg font-bold text-white">Northwest Samar State University</div>
            <div className="report-sub">Auxiliary Services and Business Affairs Office</div>
            <div className="report-title font-semibold text-white">{title}</div>
            <div className="report-period text-xs text-slate-500">Period: {period} &middot; Generated {fmtDateTime(Date.now())}</div>
          </div>
          <div className="hidden h-20 w-20 shrink-0 sm:block" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5"><tr>{table.head.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/5">
              {table.rows.slice(0, table.form ? 2000 : 300).map((r, i) => <tr key={table.vs?.[i]?.id || i} className={table.form ? 'form-row' : ''}>{r.map((c, j) => <td key={j} className="td capitalize-none">{table.form ? c : (c || '—')}</td>)}</tr>)}
              {!table.rows.length && <tr><td colSpan={table.head.length} className="td py-10 text-center text-slate-400">No records for the selected period.</td></tr>}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
