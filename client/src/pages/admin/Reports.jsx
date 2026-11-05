import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { vehicleStatus, passStatus, ROLES } from '../../lib/db';
import { PageHeader } from '../../components/ui';
import { downloadCSV, fmtDate, fmtDateTime } from '../../lib/utils';
import { useStats } from './AdminDashboard';

const REPORTS = { vehicles: 'Vehicle Registry', logs: 'Gate Activity', visitors: 'Visitor Passes', users: 'User Directory' };

export default function Reports() {
  const d = useStats();
  const [type, setType] = useState('vehicles');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const table = useMemo(() => {
    if (!d) return { head: [], rows: [] };
    const inRange = (t) => (!from || t >= new Date(from).getTime()) && (!to || t <= new Date(to).getTime() + 86399999);
    const uname = (id) => d.users.find((u) => u.id === id)?.name || '—';
    if (type === 'vehicles') return { head: ['Plate', 'Type', 'Vehicle', 'Owner', 'Status', 'Valid until'], rows: d.vehicles.filter((v) => inRange(v.createdAt)).map((v) => [v.plate, v.type, `${v.make} ${v.model}`, uname(v.userId), vehicleStatus(v), fmtDate(v.validUntil)]) };
    if (type === 'logs') return { head: ['Date/Time', 'Name', 'Plate', 'Action', 'Result', 'Reason'], rows: d.logs.filter((l) => inRange(l.timestamp)).map((l) => [fmtDateTime(l.timestamp), l.name, l.plate, l.action, l.result, l.reason]) };
    if (type === 'visitors') return { head: ['Visitor', 'Plate', 'Purpose', 'Host', 'Issued', 'Valid until', 'Status'], rows: d.passes.filter((p) => inRange(p.createdAt)).map((p) => [p.visitorName, p.plate, p.purpose, p.host, fmtDateTime(p.createdAt), fmtDateTime(p.validUntil), passStatus(p)]) };
    return { head: ['Name', 'Role', 'ID number', 'Department', 'Email', 'Joined'], rows: d.users.filter((u) => inRange(u.createdAt)).map((u) => [u.name, ROLES[u.role], u.idNumber, u.department, u.email, fmtDate(u.createdAt)]) };
  }, [d, type, from, to]);

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
  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate, print, and export system reports."
        action={<div className="no-print flex gap-2">
          <button className="btn-secondary" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</button>
          <button className="btn-primary" onClick={() => downloadCSV(`gateqr-${type}-report.csv`, [table.head, ...table.rows])}><Download className="h-4 w-4" />Export CSV</button>
        </div>} />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {summary.map(([k, v]) => <div key={k} className="card p-4"><div className="text-2xl font-bold text-white">{v}</div><div className="text-xs text-slate-500">{k}</div></div>)}
      </div>
      <div className="card">
        <div className="no-print flex flex-wrap items-end gap-3 border-b border-white/5 p-4">
          <div><label className="label">Report type</label><select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(REPORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div><label className="label">From</label><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label">To</label><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className="border-b border-white/5 px-4 py-3">
          <div className="font-semibold text-white">GateQR - {REPORTS[type]} Report</div>
          <div className="text-xs text-slate-500">Northwest Samar State University &middot; Generated {fmtDateTime(Date.now())} &middot; {table.rows.length} records</div>
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
