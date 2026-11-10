// Vercel serverless function (Node.js runtime).
// Generates a payment-instructions PDF and emails it to the vehicle owner.
//
// Mail is sent via Resend when RESEND_API_KEY is set (recommended — sender shows
// as GateQR instead of a personal Gmail account), otherwise via SMTP.
// See _mailer.js for the environment variables each provider needs.
//
// EDIT ME: the actual fee amount, cashier location, and office hours are placeholders
// below (search for "EDIT:") — update them to match NWSSU's real cashier details.

import PDFDocument from 'pdfkit';
import { brandedEmail, logoAttachment } from './_brand.js';
import { NWSSU_LOGO_B64 } from './_nwssu-logo.js';
import { mailConfigError, sendMail } from './_mailer.js';

// EDIT: set the actual vehicle pass fee and account code used by the NWSSU Cashier.
const FEE_AMOUNT = '50.00';
const FEE_AMOUNT_WORDS = 'Fifty Pesos Only';
const ACCOUNT_CODE = '__________';

// Generates a PDF styled after the NWSSU Official Receipt
// (Accountable Form No. 51-C) used at the cashier's office.
export function buildPdf({ ownerName, plate, vehicle, controlNo }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [396, 612], margin: 0 }); // half-letter, like a real OR
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const M = 14, W = 396, CW = W - M * 2;
    const B = 'Helvetica', BB = 'Helvetica-Bold';
    const NAVY = '#1e2a5a', GREEN = '#1f7a3a', GOLD = '#f59e0b', TINT = '#eef2f8';
    const fill = (x, y, w, h, c) => doc.save().rect(x, y, w, h).fill(c).restore();
    const logo = Buffer.from(NWSSU_LOGO_B64, 'base64');
    const line = (x1, y1, x2, y2, w = 0.6) =>
      doc.lineWidth(w).moveTo(x1, y1).lineTo(x2, y2).stroke('#000000');
    const box = (x, y, w, h, lw = 0.9) =>
      doc.lineWidth(lw).rect(x, y, w, h).stroke('#000000');
    const txt = (t, x, y, o = {}) =>
      doc.font(o.font || B).fontSize(o.size || 7).fillColor(o.color || '#000000').text(t, x, y, o);

    // --- Form header line ---
    // --- Brand bar (navy + gold) ---
    fill(0, 0, W, 5, NAVY); fill(0, 5, W, 1.5, GOLD);

    txt('ACCOUNTABLE FORM No. 51-C', M, 10, { size: 5.5 });
    txt('Revised January, 1992', M, 17, { size: 5.5 });
    txt('(ORIGINAL)', W - M - 42, 12, { size: 6.5, font: BB });

    // --- Title band: seal | title | receipt no. ---
    const bandY = 26, bandH = 62;
    fill(M + 56, bandY, 210, bandH, TINT);
    box(M, bandY, CW, bandH, 1.1);
    line(M + 56, bandY, M + 56, bandY + bandH);
    line(M + 266, bandY, M + 266, bandY + bandH);
    doc.image(logo, M + 5, bandY + 6, { fit: [46, 50], align: 'center', valign: 'center' });
    txt('Official Receipt', M + 56, bandY + 10, { size: 15, font: BB, width: 210, align: 'center', color: NAVY });
    txt('Republic of the Philippines', M + 56, bandY + 30, { size: 8, width: 210, align: 'center' });
    txt('NORTHWEST SAMAR STATE UNIVERSITY', M + 56, bandY + 43, { size: 7, font: BB, width: 210, align: 'center', color: GREEN });
    txt('No.', M + 272, bandY + 10, { size: 9 });
    txt(String(controlNo), M + 272, bandY + 26, { size: 12, font: BB, color: NAVY, width: CW - 272 - 24, align: 'right' });
    txt('P', W - M - 12, bandY + 10, { size: 10, font: BB });

    // --- Date row ---
    let ry = bandY + bandH;
    box(M, ry, CW, 20);
    txt('Date', M + 268, ry + 7, { size: 7 });
    txt(new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
      M + 290, ry + 7, { size: 8, width: CW - 292, align: 'right', lineBreak: false });

    // --- Agency / Fund row ---
    ry += 20;
    box(M, ry, CW, 18);
    txt('Agency', M + 4, ry + 6, { size: 7 });
    txt('Northwest Samar State University', M + 36, ry + 5, { size: 8, font: BB });
    line(M + 268, ry, M + 268, ry + 18);
    txt('Fund', M + 272, ry + 6, { size: 7 });

    // --- Payor row ---
    ry += 18;
    box(M, ry, CW, 18);
    txt('Payor', M + 4, ry + 6, { size: 7 });
    txt(String(ownerName), M + 36, ry + 5, { size: 9, font: BB, width: CW - 42 });

    // --- Collection table ---
    ry += 18;
    const C1 = M, C2 = M + 168, C3 = M + 238, C4 = M + CW;
    fill(M, ry, CW, 18, NAVY);
    box(M, ry, CW, 18);
    line(C2, ry, C2, ry + 18); line(C3, ry, C3, ry + 18);
    txt('Nature of', C1, ry + 3, { size: 7, color: '#ffffff', font: BB, width: C2 - C1, align: 'center' });
    txt('Collection', C1, ry + 10, { size: 7, color: '#ffffff', font: BB, width: C2 - C1, align: 'center' });
    txt('Account', C2, ry + 3, { size: 7, color: '#ffffff', font: BB, width: C3 - C2, align: 'center' });
    txt('Code', C2, ry + 10, { size: 7, color: '#ffffff', font: BB, width: C3 - C2, align: 'center' });
    txt('Amount', C3, ry + 6, { size: 7, color: '#ffffff', font: BB, width: C4 - C3, align: 'center' });

    // --- Ruled rows (first row carries the fee line) ---
    const ROW_H = 14, ROWS = 10;
    ry += 18;
    // faint watermark of the university seal behind the collection rows
    doc.save().opacity(0.07).image(logo, M + CW / 2 - 55, ry + 12, { fit: [110, 110] }).restore();
    box(M, ry, CW, ROW_H * ROWS);
    for (let i = 1; i < ROWS; i++) line(M, ry + i * ROW_H, M + CW, ry + i * ROW_H, 0.4);
    line(C2, ry, C2, ry + ROW_H * ROWS, 0.4);
    line(C3, ry, C3, ry + ROW_H * ROWS, 0.4);
    txt(`Vehicle Pass Registration - ${plate}`, C1 + 4, ry + 4, { size: 8, width: C2 - C1 - 8 });
    txt(String(vehicle), C1 + 4, ry + 18, { size: 7, width: C2 - C1 - 8 });
    txt(ACCOUNT_CODE, C2, ry + 4, { size: 8, width: C3 - C2, align: 'center' });
    txt('P', C3 + 4, ry + 4, { size: 8 });
    txt(FEE_AMOUNT, C3 + 14, ry + 4, { size: 8, width: C4 - C3 - 18, align: 'right' });

    // --- TOTAL row ---
    ry += ROW_H * ROWS;
    fill(M, ry, CW, 18, TINT);
    box(M, ry, CW, 18);
    line(C3, ry, C3, ry + 18);
    txt('TOTAL', C1, ry + 6, { size: 8, font: BB, width: C3 - C1, align: 'center' });
    txt('P', C3 + 4, ry + 6, { size: 8 });
    txt(FEE_AMOUNT, C3 + 14, ry + 6, { size: 9, font: BB, color: NAVY, width: C4 - C3 - 18, align: 'right' });

    // --- Amount in words ---
    ry += 18;
    box(M, ry, CW, 24);
    txt('Amount in Words', M + 4, ry + 8, { size: 7 });
    txt(FEE_AMOUNT_WORDS, M + 70, ry + 6, { size: 8, font: BB });
    line(M + 70, ry + 12, M + CW - 6, ry + 12, 0.4);
    line(M + 70, ry + 19, M + CW - 6, ry + 19, 0.4);

    // --- Payment method: Cash / Check / Money Order ---
    ry += 24;
    box(M, ry, CW, 50);
    line(M + 92, ry, M + 92, ry + 50);
    txt('Drawee', M + 92, ry + 3, { size: 7, width: 110, align: 'center' });
    txt('Bank', M + 92, ry + 10, { size: 7, width: 110, align: 'center' });
    txt('Number', M + 202, ry + 7, { size: 7, width: 90, align: 'center' });
    txt('Date', M + 292, ry + 7, { size: 7, width: CW - 292 - 92, align: 'center' });
    line(M + 92, ry + 17, M + CW, ry + 17, 0.4);
    line(M + 202, ry, M + 202, ry + 50, 0.4);
    line(M + 292, ry, M + 292, ry + 50, 0.4);
    const cb = (label, cy) => {
      doc.lineWidth(0.8).rect(M + 6, cy, 8, 8).stroke('#000000');
      txt(label, M + 18, cy + 1.5, { size: 7.5 });
    };
    cb('Cash', ry + 5);
    cb('Check', ry + 20);
    cb('Money Order', ry + 35);

    // --- Received / collecting officer ---
    ry += 50;
    box(M, ry, CW, 46);
    txt('Received the amount stated above.', M, ry + 30, { size: 7.5, width: 220, align: 'center' });
    line(M + 240, ry + 26, M + CW - 10, ry + 26);
    txt('Collecting Officer', M + 240, ry + 30, { size: 7, width: CW - 250, align: 'center' });

    // --- Footnote ---
    ry += 46;
    txt('NOTE: Write the number and date of this receipt on the back of check or money order received.',
      M, ry + 8, { size: 6, width: CW, align: 'center' });

    // --- GateQR note (outside the form) ---
    fill(0, 612 - 8, W, 8, NAVY);
    txt('Generated by the GateQR Vehicle Pass Registration System. Present this order of payment at the NWSSU Cashier\'s Office together with a valid ID.',
      M, ry + 26, { size: 6, width: CW, align: 'center', color: '#555555' });

    doc.end();
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const configError = mailConfigError();
  if (configError) return res.status(500).json({ error: configError });

  try {
    const { to, ownerName, plate, vehicle, controlNo } = req.body || {};
    if (!to || !ownerName || !plate) return res.status(400).json({ error: 'Missing required fields (to, ownerName, plate).' });

    const pdfBuffer = await buildPdf({ ownerName, plate, vehicle: vehicle || '—', controlNo: controlNo || plate });

    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const bodyHtml =
      '<p style="margin:0 0 14px;font-size:14px;color:#334155">Dear ' + esc(ownerName) + ',</p>'
      + '<p style="margin:0 0 14px;font-size:14px;color:#334155">Your vehicle registration (plate <b>' + esc(plate) + '</b>) is ready for payment. The registration fee is <b>&#8369;50.00</b> — please see the attached official receipt form and pay at the NWSSU Cashier.</p>'
      + '<p style="margin:0;font-size:14px;color:#334155">After paying, upload your receipt in GateQR under <b>My Vehicles</b> so the administrator can approve your QR gate pass.</p>';

    await sendMail({
      to,
      subject: 'Payment Instructions for Your Vehicle Pass Registration - GateQR',
      text: `Dear ${ownerName},\n\nYour vehicle registration (plate ${plate}) is ready for payment. The registration fee is PHP 50.00 — please see the attached official receipt form and pay at the NWSSU Cashier. After paying, upload your receipt in GateQR under "My Vehicles" so the administrator can approve your QR gate pass.\n\n- GateQR, NWSSU`,
      html: brandedEmail('Payment instructions for your vehicle pass', bodyHtml),
      attachments: [
        { filename: `GateQR-Payment-Notice-${plate}.pdf`, content: pdfBuffer, contentType: 'application/pdf' },
        logoAttachment(),
      ],
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-payment-notice error:', err);
    return res.status(500).json({ error: 'Failed to send the payment notice email. Please check the email configuration and try again.', detail: String(err?.message || err) });
  }
}
