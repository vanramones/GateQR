import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, Clock, Users, Ticket, LogIn, ShieldAlert, ArrowRight, ParkingSquare } from 'lucide-react';
import { staffApi as api, vehicleStatus, passStatus } from '../../lib/db';
import { PageHeader, StatCard, StatusBadge, Empty } from '../../components/ui';
import { fmtDateTime, cx } from '../../lib/utils';

export function useStats() {
  const [d, setD] = useState(null);
  useEffect(() => { Promise.all([api.listVehicles(), api.listUsers(), api.listPasses(), api.listLogs(), api.getSlotStats()]).then(([vehicles, users, passes, logs, slots]) => setD({ vehicles, users, passes, logs, slots })); }, []);
  return d;
}

export default function AdminDashboard() {
  const d = useStats();
  if (!d) return null;
  const { vehicles, users, passes, logs, slots } = d;
  const today = new Date().toDateString();
  const todayLogs = logs.filter((l) => new Date(l.timestamp).toDateString() === today);
  const pending = vehicles.filter((v) => vehicleStatus(v) === 'pending');

  const days = [...Array(7)].map((_, i) => {
    const dt = new Date(Date.now() - (6 - i) * 86400000);
    const n = logs.filter((l) => l.result === 'granted' && l.action === 'entry' && new Date(l.timestamp).toDateString() === dt.toDateString()).length;
    return { label: dt.toLocaleDateString('en-PH', { weekday: 'short' }), date: dt.toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' }), today: i === 6, n };
  });
  const total = days.reduce((s, x) => s + x.n, 0);
  const avg = Math.round(total / 7);
  const peak = days.reduce((a, x) => (x.n > a.n ? x : a), days[0]);
  const top = Math.max(4, Math.ceil(peak.n / 4) * 4);
  const ticks = [top, (top * 3) / 4, top / 2, top / 4, 0];

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Overview of vehicle registrations and campus gate activity." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Car} label="Approved vehicles" value={vehicles.filter((v) => vehicleStatus(v) === 'approved').length} tone="green" />
        <StatCard icon={Clock} label="Pending approvals" value={pending.length} tone="amber" />
        <StatCard icon={Users} label="Registered users" value={users.filter((u) => u.role !== 'admin' && u.role !== 'guard').length} />
        <StatCard icon={Ticket} label="Active visitor passes" value={passes.filter((p) => passStatus(p) === 'active').length} tone="violet" />
        <StatCard icon={LogIn} label="Entries today" value={todayLogs.filter((l) => l.action === 'entry' && l.result === 'granted').length} />
        <StatCard icon={ShieldAlert} label="Denied today" value={todayLogs.filter((l) => l.result === 'denied').length} tone="red" />
      </div>

      <div className="card mt-6 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cx('flex h-11 w-11 items-center justify-center rounded-xl', slots.full ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600')}><ParkingSquare className="h-6 w-6" /></div>
            <div>
              <div className="font-semibold text-white">Vehicle pass slot usage</div>
              <div className="text-sm text-slate-500">{slots.used} of {slots.total} slots reserved (pending + approved)</div>
            </div>
          </div>
          <Link to="/admin/settings" className="flex items-center gap-1 text-sm font-medium text-brand-600">Manage capacity <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className={cx('h-full rounded-full', slots.full ? 'bg-red-500' : 'bg-brand-600')} style={{ width: `${Math.min(100, (slots.used / slots.total) * 100)}%` }} />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Campus entries - last 7 days</h2>
              <p className="text-xs text-slate-500">Granted entries per day</p>
            </div>
            <div className="flex gap-2 text-center">
              {[['Total', total], ['Daily avg', avg], ['Peak', peak.n]].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-white/5 bg-white/5 px-3 py-1.5"><div className="text-base font-bold text-white">{v}</div><div className="text-[10px] uppercase tracking-wide text-slate-500">{k}</div></div>
              ))}
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <div className="flex h-44 flex-col justify-between pb-0 text-right text-[10px] text-slate-500">
              {ticks.map((t) => <span key={t} className="leading-none">{t}</span>)}
            </div>
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-x-0 top-0 flex h-44 flex-col justify-between">
                {ticks.map((t) => <div key={t} className="border-t border-dashed border-white/10" />)}
              </div>
              <div className="relative flex h-44 items-end gap-3">
                {days.map((x, i) => (
                  <div key={i} className="group relative flex h-full flex-1 items-end" title={`${x.date}: ${x.n} ${x.n === 1 ? 'entry' : 'entries'}`}>
                    <div className={cx('w-full rounded-t-md transition-all duration-500 group-hover:brightness-125', x.today ? 'bg-gradient-to-t from-brand-600 to-brand-400 shadow-[0_0_16px_rgba(16,185,129,0.45)]' : 'bg-gradient-to-t from-brand-600/60 to-brand-400/70')} style={{ height: x.n ? `${(x.n / top) * 100}%` : 3, minHeight: 3 }}>
                      <div className="-translate-y-5 text-center text-xs font-semibold text-slate-200">{x.n}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-3">
                {days.map((x, i) => <div key={i} className={cx('flex-1 text-center text-xs', x.today ? 'font-semibold text-brand-400' : 'text-slate-500')}>{x.today ? 'Today' : x.label}</div>)}
              </div>
            </div>
          </div>
        </div>
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4"><h2 className="font-semibold text-white">Pending approvals</h2><Link to="/admin/registrations" className="flex items-center gap-1 text-sm font-medium text-brand-600">Review <ArrowRight className="h-4 w-4" /></Link></div>
          {!pending.length ? <Empty title="All caught up" text="No registrations waiting for review." /> : (
            <ul className="divide-y divide-white/5">
              {pending.slice(0, 5).map((v) => {
                const o = users.find((u) => u.id === v.userId);
                return <li key={v.id} className="px-5 py-3"><div className="font-semibold text-white">{v.plate} <span className="font-normal text-slate-500">&middot; {v.make} {v.model}</span></div><div className="text-xs text-slate-500">{o?.name}</div></li>;
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4"><h2 className="font-semibold text-white">Latest gate activity</h2><Link to="/admin/logs" className="flex items-center gap-1 text-sm font-medium text-brand-600">All logs <ArrowRight className="h-4 w-4" /></Link></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5"><tr>{['Time', 'Name', 'Plate', 'Action', 'Result'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/5">
              {logs.slice(0, 6).map((l) => (
                <tr key={l.id}><td className="td">{fmtDateTime(l.timestamp)}</td><td className="td font-medium">{l.name || '—'}</td><td className="td font-mono">{l.plate || '—'}</td><td className="td"><StatusBadge status={l.action} /></td><td className="td"><StatusBadge status={l.result} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
