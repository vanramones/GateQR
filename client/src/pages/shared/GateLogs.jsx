import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Empty, PageHeader, StatusBadge } from '../../components/ui';
import { downloadCSV, fmtDateTime } from '../../lib/utils';

// Used by both the Admin (office) and Guard (gate) portals, each of which
// passes in its own independent `api` so the two sessions never mix.
export default function GateLogs({ api, title = 'Gate Logs', subtitle = 'Complete record of vehicle entries, exits, and denied attempts.' }) {
  const [logs, setLogs] = useState([]);
  const [q, setQ] = useState('');
  const [action, setAction] = useState('all');
  const [result, setResult] = useState('all');
  const [date, setDate] = useState('');
  useEffect(() => { api.listLogs().then(setLogs); }, []);

  const rows = useMemo(() => logs.filter((l) =>
    (action === 'all' || l.action === action) && (result === 'all' || l.result === result) &&
    (!date || new Date(l.timestamp).toISOString().slice(0, 10) === date || new Date(l.timestamp).toLocaleDateString('en-CA') === date) &&
    (!q || `${l.plate} ${l.name}`.toLowerCase().includes(q.toLowerCase()))), [logs, q, action, result, date]);

  const exportCsv = () => downloadCSV('gate-logs.csv', [['Date/Time', 'Type', 'Name', 'Plate', 'Action', 'Result', 'Reason'], ...rows.map((l) => [fmtDateTime(l.timestamp), l.type, l.name, l.plate, l.action, l.result, l.reason])]);

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle}
        action={<button className="btn-secondary" onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" />Export CSV</button>} />
      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-white/5 p-4">
          <div className="relative min-w-[200px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input pl-9" placeholder="Search plate or name..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input w-auto" value={action} onChange={(e) => setAction(e.target.value)}><option value="all">All actions</option><option value="entry">Entry</option><option value="exit">Exit</option></select>
          <select className="input w-auto" value={result} onChange={(e) => setResult(e.target.value)}><option value="all">All results</option><option value="granted">Granted</option><option value="denied">Denied</option></select>
          <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {!rows.length ? <Empty title="No logs found" text="Try adjusting your filters." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5"><tr>{['Date / Time', 'Type', 'Name', 'Plate', 'Action', 'Result', 'Reason'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-white/5">
                {rows.slice(0, 200).map((l) => (
                  <tr key={l.id} className="hover:bg-white/5">
                    <td className="td whitespace-nowrap">{fmtDateTime(l.timestamp)}</td>
                    <td className="td capitalize">{l.type}</td>
                    <td className="td font-medium text-white">{l.name || '—'}</td>
                    <td className="td font-mono">{l.plate || '—'}</td>
                    <td className="td"><StatusBadge status={l.action} /></td>
                    <td className="td"><StatusBadge status={l.result} /></td>
                    <td className="td text-slate-500">{l.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-white/5 px-4 py-3 text-xs text-slate-500">Showing {Math.min(rows.length, 200)} of {rows.length} records</div>
      </div>
    </div>
  );
}
