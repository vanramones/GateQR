import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Clock, AlertTriangle } from 'lucide-react';
import { vehicleStatus } from '../lib/db';
import { fmtDate, fmtDateTime } from '../lib/utils';

const THIRTY_DAYS = 30 * 86400000;

export default function NotificationBell({ api }) {
  const [open, setOpen] = useState(false);
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    let active = true;
    const load = () => api.listVehicles().then((v) => { if (active) setVehicles(v); }).catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const pending = vehicles.filter((v) => vehicleStatus(v) === 'pending').sort((a, b) => b.createdAt - a.createdAt);
  const expiringSoon = vehicles.filter((v) => vehicleStatus(v) === 'approved' && v.validUntil - Date.now() < THIRTY_DAYS).sort((a, b) => a.validUntil - b.validUntil);
  const count = pending.length + expiringSoon.length;

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 text-slate-300 hover:bg-white/10" title="Notifications">
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">Notifications</div>
            <div className="max-h-96 overflow-y-auto">
              {!count ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">You&apos;re all caught up.</div>
              ) : (
                <>
                  {pending.length > 0 && (
                    <div className="pb-1">
                      <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pending registrations</div>
                      {pending.slice(0, 5).map((v) => (
                        <Link key={v.id} to="/admin/registrations" onClick={() => setOpen(false)} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/5">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400"><Clock className="h-4 w-4" /></div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-white">{v.plate} &middot; {v.make} {v.model}</div>
                            <div className="text-xs text-slate-500">Awaiting approval &middot; {fmtDateTime(v.createdAt)}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {expiringSoon.length > 0 && (
                    <div className="pb-1">
                      <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Expiring soon</div>
                      {expiringSoon.slice(0, 5).map((v) => (
                        <Link key={v.id} to="/admin/vehicles" onClick={() => setOpen(false)} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/5">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400"><AlertTriangle className="h-4 w-4" /></div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-white">{v.plate} &middot; {v.make} {v.model}</div>
                            <div className="text-xs text-slate-500">Expires {fmtDate(v.validUntil)}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            {!!count && (
              <Link to="/admin/registrations" onClick={() => setOpen(false)} className="block border-t border-white/10 px-4 py-2.5 text-center text-sm font-medium text-brand-400 hover:bg-white/5">View all registrations</Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
