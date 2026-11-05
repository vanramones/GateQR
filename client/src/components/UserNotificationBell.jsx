import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle2, XCircle, Info } from 'lucide-react';
import { fmtDateTime } from '../lib/utils';
import { cx } from '../lib/utils';

const iconFor = (title) =>
  /approved/i.test(title) ? { Icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-400' }
    : /reject|denied|not approved/i.test(title) ? { Icon: XCircle, cls: 'bg-red-500/15 text-red-400' }
    : { Icon: Info, cls: 'bg-brand-500/15 text-brand-300' };

export default function UserNotificationBell({ api }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    const load = () => api.listNotifications().then((n) => { if (active) setItems(n); }).catch(() => {});
    load();
    const id = setInterval(load, 30000);
    return () => { active = false; clearInterval(id); };
  }, []);

  const unread = items.filter((n) => !n.read);

  const markAll = () => { const ids = unread.map((n) => n.id); setItems((it) => it.map((n) => ({ ...n, read: true }))); api.markNotificationsRead(ids).catch(() => {}); };
  const markOne = (n) => { if (!n.read) { setItems((it) => it.map((x) => (x.id === n.id ? { ...x, read: true } : x))); api.markNotificationsRead([n.id]).catch(() => {}); } };

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 text-slate-300 hover:bg-white/10" title="Notifications">
        <Bell className="h-5 w-5" />
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-sm font-semibold text-white">Notifications</span>
              {unread.length > 0 && (
                <button onClick={markAll} className="text-xs font-medium text-brand-400 hover:text-brand-300">Mark all read</button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {!items.length ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">No notifications yet.</div>
              ) : (
                items.map((n) => {
                  const { Icon, cls } = iconFor(n.title);
                  return (
                    <Link key={n.id} to="/app/vehicles" onClick={() => { markOne(n); setOpen(false); }}
                      className={cx('flex items-start gap-3 px-4 py-3 hover:bg-white/5', !n.read && 'bg-brand-500/5')}>
                      <div className={cx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', cls)}><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <div className={cx('truncate text-sm', n.read ? 'font-medium text-slate-300' : 'font-semibold text-white')}>{n.title}</div>
                        <div className="text-xs text-slate-500">{n.body}</div>
                        <div className="mt-0.5 text-[11px] text-slate-600">{fmtDateTime(n.createdAt)}</div>
                      </div>
                      {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
