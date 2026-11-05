import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, CheckCircle2, Clock, AlertTriangle, Plus, ArrowRight } from 'lucide-react';
import { useUserAuth } from '../../context/AuthContext';
import { userApi as api, vehicleStatus } from '../../lib/db';
import { PageHeader, StatCard, VehicleStatus, Empty } from '../../components/ui';
import { fmtDate, fmtDateTime } from '../../lib/utils';

export default function UserDashboard() {
  const { user } = useUserAuth();
  const [vs, setVs] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.listVehicles(user.id).then((v) => { setVs(v); api.listLogs().then((l) => setLogs(l.filter((x) => v.some((y) => y.id === x.refId)).slice(0, 6))).catch(() => setLogs([])); }).catch(() => setVs([]));
  }, []);
  const c = (s) => vs.filter((v) => vehicleStatus(v) === s).length;
  const soon = vs.filter((v) => vehicleStatus(v) === 'approved' && v.validUntil - Date.now() < 30 * 86400000);

  return (
    <div>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Here is an overview of your vehicle registrations."
        action={<Link to="/app/register" className="btn-primary"><Plus className="h-4 w-4" />Register vehicle</Link>} />
      {soon.length > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>Your pass for <b>{soon.map((v) => v.plate).join(', ')}</b> will expire within 30 days. Please prepare for renewal.</div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Car} label="Total vehicles" value={vs.length} />
        <StatCard icon={CheckCircle2} tone="green" label="Approved" value={c('approved')} />
        <StatCard icon={Clock} tone="amber" label="Pending" value={c('pending')} />
        <StatCard icon={AlertTriangle} tone="red" label="Expired / Rejected" value={c('expired') + c('rejected')} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4"><h2 className="font-semibold text-white">Recent vehicles</h2><Link to="/app/vehicles" className="flex items-center gap-1 text-sm font-medium text-brand-600">View all <ArrowRight className="h-4 w-4" /></Link></div>
          {!vs.length ? <Empty title="No vehicles yet" text="Register a vehicle to get your QR pass." /> : (
            <ul className="divide-y divide-white/5">
              {vs.slice(0, 5).map((v) => (
                <li key={v.id} className="flex items-center justify-between px-5 py-3.5"><div><div className="font-semibold text-white">{v.plate}</div><div className="text-xs text-slate-500">{v.make} {v.model} &middot; {fmtDate(v.createdAt)}</div></div><VehicleStatus v={v} /></li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4"><h2 className="font-semibold text-white">Recent gate activity</h2><Link to="/app/activity" className="flex items-center gap-1 text-sm font-medium text-brand-600">View all <ArrowRight className="h-4 w-4" /></Link></div>
          {!logs.length ? <Empty title="No gate activity" text="Your entry and exit records will appear here." /> : (
            <ul className="divide-y divide-white/5">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-5 py-3.5"><div><div className="font-semibold capitalize text-white">{l.action} &middot; {l.plate}</div><div className="text-xs text-slate-500">{fmtDateTime(l.timestamp)}</div></div><span className={`text-xs font-semibold ${l.result === 'granted' ? 'text-emerald-600' : 'text-red-600'}`}>{l.result}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
