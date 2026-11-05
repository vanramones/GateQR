import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Car, PlusCircle, Users, UserCheck, UserPlus, ScanLine, Ticket, ClipboardList, BarChart3, UserCircle, LogOut, Menu, X, Settings } from 'lucide-react';
import { Logo } from './ui';
import NotificationBell from './NotificationBell';
import UserNotificationBell from './UserNotificationBell';
import { ROLES, staffApi, userApi } from '../lib/db';
import { cx } from '../lib/utils';

const NAV = {
  admin: [
    ['/admin', 'Dashboard', LayoutDashboard, true], ['/admin/registrations', 'Registrations', UserCheck], ['/admin/vehicles', 'All Vehicles', Car],
    ['/admin/visitors', 'Visitor Passes', Ticket], ['/admin/logs', 'Gate Logs', ClipboardList], ['/admin/reports', 'Reports', BarChart3],
    ['/admin/users', 'Users', Users], ['/admin/create-account', 'Create Account', UserPlus], ['/admin/settings', 'Settings', Settings], ['/admin/profile', 'My Profile', UserCircle],
  ],
  guard: [
    ['/guard', 'Gate Scanner', ScanLine, true], ['/guard/visitors', 'Visitor Passes', Ticket], ['/guard/logs', 'Gate Logs', ClipboardList], ['/guard/profile', 'My Profile', UserCircle],
  ],
  user: [
    ['/app', 'Dashboard', LayoutDashboard, true], ['/app/vehicles', 'My Vehicles', Car], ['/app/register', 'Register Vehicle', PlusCircle], ['/app/activity', 'Gate Activity', ClipboardList], ['/profile', 'My Profile', UserCircle],
  ],
};

export default function Layout({ user, logout }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const isAdmin = user.role === 'admin';
  const items = NAV[isAdmin ? 'admin' : user.role === 'guard' ? 'guard' : 'user'];
  const doLogout = async () => { await logout(); nav(user.role === 'admin' ? '/admin/login' : user.role === 'guard' ? '/guard/login' : '/login'); };

  // expanded=false -> collapsed icon rail that widens on hover (desktop only).
  const sidebar = (expanded) => (
    <div className="flex h-full flex-col border-r border-white/10 bg-slate-950 text-white">
      <div className="border-b border-white/10 px-5 py-5"><Logo light /></div>
      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {items.map(([to, label, Icon, end]) => (
          <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} title={label}
            className={({ isActive }) => cx('flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition', expanded ? 'gap-3' : 'justify-center gap-0', isActive ? 'bg-brand-500/15 text-brand-300 ring-1 ring-inset ring-brand-400/20' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>
            <Icon className="h-[18px] w-[18px] shrink-0" /><span className={cx('whitespace-nowrap transition-opacity duration-150', expanded ? 'opacity-100' : 'hidden opacity-0')}>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className={cx('mb-3 flex items-center', expanded ? 'gap-3' : 'justify-center')}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">{user.name[0]}</div>
          <div className={cx('min-w-0', expanded ? '' : 'hidden')}>
            <div className="truncate text-sm font-semibold text-white">{user.name}</div>
            <div className="text-xs text-slate-400">{ROLES[user.role]}</div>
          </div>
        </div>
        <button onClick={doLogout} title="Sign out" className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10">
          <LogOut className="h-4 w-4 shrink-0" /><span className={expanded ? '' : 'hidden'}>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 lg:flex">
      {isAdmin ? (
        <aside
          className="fixed inset-y-0 left-0 z-30 hidden overflow-hidden transition-[width] duration-200 lg:block"
          style={{ width: hover ? 256 : 80 }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >{sidebar(hover)}</aside>
      ) : (
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar(true)}</aside>
      )}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/80" onClick={() => setOpen(false)} />
          <div className="relative h-full w-64">{sidebar(true)}</div>
        </div>
      )}
      <div className={cx('flex-1', isAdmin ? 'lg:pl-20' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur">
          <div className="lg:hidden"><Logo light /></div>
          <div className="ml-auto flex items-center gap-1">
            {user.role === 'admin' && <NotificationBell api={staffApi} />}
            {!['admin', 'guard'].includes(user.role) && <UserNotificationBell api={userApi} />}
            <button onClick={() => setOpen(!open)} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden">{open ? <X /> : <Menu />}</button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
