export const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
export const fmtDateTime = (t) => (t ? new Date(t).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
export const fmtTime = (t) => new Date(t).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
export const cx = (...c) => c.filter(Boolean).join(' ');

export function downloadCSV(filename, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadQR(containerId, filename) {
  const canvas = document.querySelector(`#${containerId} canvas`);
  if (!canvas) return;
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}
