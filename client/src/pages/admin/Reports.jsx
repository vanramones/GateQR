import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { vehicleStatus, passStatus, ROLES } from '../../lib/db';
import { PageHeader } from '../../components/ui';
import { downloadCSV, fmtDate, fmtDateTime, fmtTime } from '../../lib/utils';
import { useStats } from './AdminDashboard';

export const LOGO_SRC = '/images/nwssu-logo.png';
const REPORTS = { logs: 'Gate Log', vehicles: 'Vehicle Registry', visitors: 'Visitor Passes', users: 'User Directory' };
const CATEGORIES = { all: 'All', student: 'Student', faculty: 'Faculty', staff: 'Staff', visitor: 'Visitor' };

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
const dayKey = (t) => new Date(t).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });

export default function Reports() {
  const d = useStats();
  const [type, setType] = useState('logs');
  const [category, setCategory] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const table = useMemo(() => {
    if (!d) return { head: [], rows: [] };
    const inRange = (t) => (!from || t >= new Date(from).getTime()) && (!to || t <= new Date(to).getTime() + 86399999);
    const user = (id) => d.users.find((u) => u.id === id);
    const uname = (id) => user(id)?.name || '—';
    const catOk = (role) => category === 'all' || role === category;

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
        .map((x, i) => [i + 1, dayKey(x.ref), x.l.name || x.owner?.name || pById[x.l.refId]?.visitorName, x.role ? (x.role === 'visitor' ? 'Visitor' : ROLES[x.role]) : '—', x.owner?.idNumber || '—', x.l.plate, x.s.inAt ? fmtTime(x.s.inAt) : '—', x.s.outAt ? fmtTime(x.s.outAt) : '—', guard(x.s.guardIn || x.s.guardOut)]);
      return { head: ['No.', 'Date', 'Name', 'Role', 'ID No.', 'Plate No.', 'Time In', 'Time Out', 'Guard on Duty'], rows };
    }
    if (type === 'visitors') {
      if (category !== 'all' && category !== 'visitor') return { head: ['No.', 'Visitor', 'Plate', 'Purpose', 'Host', 'Issued', 'Valid until', 'Status'], rows: [] };
      return { head: ['No.', 'Visitor', 'Plate', 'Purpose', 'Host', 'Issued', 'Valid until', 'Status'], rows: d.passes.filter((p) => inRange(p.createdAt)).map((p, i) => [i + 1, p.visitorName, p.plate, p.purpose, p.host, fmtDateTime(p.createdAt), fmtDateTime(p.validUntil), passStatus(p)]) };
    }
    return { head: ['No.', 'Name', 'Role', 'ID number', 'Department', 'Email', 'Joined'], rows: d.users.filter((u) => inRange(u.createdAt) && catOk(u.role)).map((u, i) => [i + 1, u.name, ROLES[u.role], u.idNumber, u.department, u.email, fmtDate(u.createdAt)]) };
  }, [d, type, category, from, to]);

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
  const title = `NwSSU GateQR ${REPORTS[type]} Report${catLabel}`;
  const filename = `NwSSU_GateQR_${slug(REPORTS[type])}_Report${category === 'all' ? '' : `_${CATEGORIES[category]}`}_${from || 'start'}_to_${to || new Date().toISOString().slice(0, 10)}.csv`;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate, print, and export system reports."
        action={<div className="no-print flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</button>
          <button className="btn-primary" onClick={() => downloadCSV(filename, [['Northwest Samar State University'], [title], [`Period: ${period}`], [], table.head, ...table.rows])}><Download className="h-4 w-4" />Export CSV</button>
        </div>} />
      <div className="no-print mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {summary.map(([k, v]) => <div key={k} className="card p-4"><div className="text-2xl font-bold text-white">{v}</div><div className="text-xs text-slate-500">{k}</div></div>)}
      </div>
      <div className="card">
        <div className="no-print flex flex-wrap items-end gap-3 border-b border-white/5 p-4">
          <div><label className="label">Report type</label><select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(REPORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="label">Report for</label><select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="label">From</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">To</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className="report-header flex items-center gap-4 border-b border-white/5 px-4 py-4">
          <img src={LOGO_SRC} alt="NwSSU logo" className="h-16 w-16 shrink-0 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="flex-1 text-center">
            <div className="text-xs uppercase tracking-widest text-slate-400">Republic of the Philippines</div>
            <div className="text-lg font-bold text-white">Northwest Samar State University</div>
            <div className="font-semibold text-white">{title}</div>
            <div className="text-xs text-slate-500">Period: {period} &middot; Generated {fmtDateTime(Date.now())} &middot; {table.rows.length} records</div>
          </div>
          <div className="hidden h-16 w-16 shrink-0 sm:block" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5"><tr>{table.head.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/5">
              {table.rows.slice(0, 300).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="td capitalize-none">{c || '—'}</td>)}</tr>)}
              {!table.rows.length && <tr><td colSpan={table.head.length} className="td py-10 text-center text-slate-400">No records for the selected period.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
