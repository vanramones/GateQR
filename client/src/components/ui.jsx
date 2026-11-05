import { X, Inbox, QrCode } from 'lucide-react';
import { cx } from '../lib/utils';
import { vehicleStatus, passStatus } from '../lib/db';

export function Logo({ light = false, size = 'md' }) {
  const s = size === 'lg' ? 'h-12 w-12' : 'h-9 w-9';
  return (
    <div className="flex items-center gap-2.5">
      <div className={cx('flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-md', s)}>
        <QrCode className={size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'} />
      </div>
      <div className="leading-tight">
        <div className={cx('font-extrabold tracking-tight', size === 'lg' ? 'text-2xl' : 'text-lg', light ? 'text-white' : 'text-slate-900')}>
          Gate<span className={light ? 'text-brand-300' : 'text-brand-600'}>QR</span>
        </div>
        <div className={cx('text-[10px] font-medium uppercase tracking-wider', light ? 'text-brand-200' : 'text-slate-500')}>NWSSU Vehicle Pass</div>
      </div>
    </div>
  );
}

const TONES = {
  green: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  amber: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
  red: 'bg-red-500/15 text-red-300 ring-red-400/30',
  blue: 'bg-sky-500/15 text-sky-300 ring-sky-400/30',
  slate: 'bg-white/5 text-slate-300 ring-white/10',
};
export const Badge = ({ tone = 'slate', children }) => (
  <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset', TONES[tone])}>{children}</span>
);

const STATUS_TONE = { approved: 'green', active: 'green', granted: 'green', pending: 'amber', rejected: 'red', expired: 'red', revoked: 'red', denied: 'red', entry: 'blue', exit: 'slate' };
export const StatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status] || 'slate'}>{status}</Badge>;
export const VehicleStatus = ({ v }) => <StatusBadge status={vehicleStatus(v)} />;
export const PassStatus = ({ p }) => <StatusBadge status={passStatus(p)} />;

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, tone = 'blue', hint }) {
  const tones = { blue: 'bg-sky-500/15 text-sky-300', green: 'bg-emerald-500/15 text-emerald-300', amber: 'bg-amber-500/15 text-amber-300', red: 'bg-red-500/15 text-red-300', violet: 'bg-violet-500/15 text-violet-300' };
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className={cx('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', tones[tone])}><Icon className="h-6 w-6" /></div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="truncate text-sm text-slate-400">{label}</div>
        {hint && <div className="text-xs text-slate-500">{hint}</div>}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cx('card relative max-h-[90vh] w-full overflow-y-auto bg-slate-900 p-6 shadow-xl', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// In-page document lightbox: previews an image or PDF inside a modal instead
// of opening a new browser tab. `doc` = { url, label, isPdf }.
export function DocViewer({ doc, onClose }) {
  if (!doc) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="card relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-white">{doc.label || 'Document'}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-950/40">
          {doc.isPdf ? (
            <iframe src={doc.url} title={doc.label || 'Document'} className="h-[78vh] w-full" />
          ) : (
            <img src={doc.url} alt={doc.label || 'Document'} className="mx-auto max-h-[80vh] object-contain" />
          )}
        </div>
      </div>
    </div>
  );
}

export const Empty = ({ title = 'Nothing here yet', text, children }) => (
  <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-slate-500"><Inbox className="h-6 w-6" /></div>
    <div className="font-semibold text-slate-200">{title}</div>
    {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
    {children && <div className="mt-4">{children}</div>}
  </div>
);

export const Field = ({ label, error, hint, children }) => (
  <div>
    {label && <label className="label">{label}</label>}
    {children}
    {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    {error && <p className="mt-1 text-xs font-medium text-red-400">{error}</p>}
  </div>
);

export const Alert = ({ tone = 'red', children }) => (
  <div className={cx('rounded-lg border px-3.5 py-2.5 text-sm', tone === 'red' ? 'border-red-500/30 bg-red-500/10 text-red-300' : tone === 'green' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-brand-500/30 bg-brand-500/10 text-brand-200')}>{children}</div>
);

export const Spinner = () => <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
export const PageSpinner = () => (
  <div className="flex h-screen items-center justify-center bg-slate-950"><div className="h-9 w-9 animate-spin rounded-full border-4 border-white/10 border-t-brand-500" /></div>
);
