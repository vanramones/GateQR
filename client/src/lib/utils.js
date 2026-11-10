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
  const load = async (url) => { const r = await fetch(url); return r.ok ? r.blob() : null; };
  const b64 = (blob) => new Promise((res) => { const f = new FileReader(); f.onload = () => res(f.result); f.readAsDataURL(blob); });
  const [reg, bold, logo] = await Promise.all(['/fonts/NotoSans-Regular.ttf', '/fonts/NotoSans-Bold.ttf', '/images/nwssu-logo.jpg'].map((u) => load(u).catch(() => null)));
  let font = 'helvetica';
  if (reg && bold) {
    doc.addFileToVFS('NotoSans-Regular.ttf', (await b64(reg)).split(',')[1]);
    doc.addFileToVFS('NotoSans-Bold.ttf', (await b64(bold)).split(',')[1]);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
    font = 'NotoSans';
  }
  const W = doc.internal.pageSize.getWidth();
  const M = 36;
  const navy = [27, 42, 107];
  const cx = W / 2;
  if (logo) doc.addImage(await b64(logo), 'JPEG', M, 28, 66, 66);
  doc.setFont(font, 'normal').setFontSize(7).setTextColor(30).text('REPUBLIC OF THE PHILIPPINES', cx, 38, { align: 'center', charSpace: 1 });
  doc.setFont(font, 'bold').setFontSize(14).setTextColor(...navy).text('Northwest Samar State University', cx, 55, { align: 'center' });
  doc.setFontSize(9).setTextColor(0).text('AUXILIARY SERVICES AND BUSINESS AFFAIRS OFFICE', cx, 71, { align: 'center' });
  const t = String(title).toUpperCase();
  doc.setFontSize(10).text(t, cx, 87, { align: 'center' });
  const tw = doc.getTextWidth(t);
  doc.setLineWidth(0.8).setDrawColor(0).line(cx - tw / 2, 89, cx + tw / 2, 89);
  doc.setFont(font, 'normal').setFontSize(7).text(`Period: ${period} \u00b7 Generated ${fmtDateTime(Date.now())}`, cx, 101, { align: 'center' });
  doc.setDrawColor(245, 180, 20).setLineWidth(2.5).line(M, 112, W - M, 112);
  doc.setDrawColor(...navy).setLineWidth(1.5).line(M, 115, W - M, 115);
  autoTable(doc, {
    startY: 126, margin: { left: M, right: M, bottom: 36 },
    head: [head], body: rows.map((r) => r.map((v) => String(v ?? ''))),
    theme: 'grid',
    styles: { font, fontSize: 8.5, textColor: 0, lineColor: 0, lineWidth: 0.6, cellPadding: { top: 7, bottom: 7, left: 6, right: 6 } },
    headStyles: { font, fontStyle: 'bold', fillColor: [232, 238, 248], textColor: navy, halign: 'center', fontSize: 8 },
    didDrawPage: (d) => { doc.setFont(font, 'normal').setFontSize(7).setTextColor(100).text(`Page ${d.pageNumber}`, W - M, doc.internal.pageSize.getHeight() - 18, { align: 'right' }); },
  });
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
