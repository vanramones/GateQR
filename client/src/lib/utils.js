export const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
export const fmtDateTime = (t) => (t ? new Date(t).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
export const fmtTime = (t) => new Date(t).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
export const toLocalInput = (t) => (t ? new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
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

export async function downloadPDF(filename, { title, period, head, rows }) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: head.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  doc.setFontSize(14).text('Northwest Samar State University', 40, 40);
  doc.setFontSize(12).text(title, 40, 58);
  doc.setFontSize(9).text(`Period: ${period}`, 40, 74);
  autoTable(doc, { startY: 90, head: [head], body: rows.map((r) => r.map((v) => String(v ?? ''))), styles: { fontSize: 8 }, headStyles: { fillColor: [16, 185, 129] } });
  doc.save(filename);
}

export function downloadQR(containerId, filename) {
  const canvas = document.querySelector(`#${containerId} canvas`);
  if (!canvas) return;
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}
