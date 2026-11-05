// Vercel serverless function (Node.js runtime).
// Emails the vehicle owner when their registration is approved or rejected.
// Uses the same mail environment variables as send-payment-notice.js (see _mailer.js).

import { brandedEmail, infoRow, logoAttachment } from './_brand.js';
import { mailConfigError, sendMail } from './_mailer.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const configError = mailConfigError();
  if (configError) return res.status(500).json({ error: configError });

  try {
    const { to, ownerName, plate, vehicle, decision, remarks, validUntil } = req.body || {};
    if (!to || !ownerName || !plate || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'Missing or invalid fields (to, ownerName, plate, decision).' });
    }

    const approved = decision === 'approved';
    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const subject = approved
      ? `Vehicle Registration APPROVED - ${plate} - GateQR`
      : `Vehicle Registration Update - ${plate} - GateQR`;

    const statusBadge = approved
      ? '<span style="display:inline-block;background:#d1fae5;color:#047857;font-size:13px;font-weight:700;padding:4px 14px;border-radius:999px">APPROVED</span>'
      : '<span style="display:inline-block;background:#fee2e2;color:#b91c1c;font-size:13px;font-weight:700;padding:4px 14px;border-radius:999px">NOT APPROVED</span>';

    const rows = infoRow('Plate number', esc(plate)) + infoRow('Vehicle', esc(vehicle || '—'))
      + (approved && validUntil ? infoRow('Pass valid until', esc(validUntil)) : '')
      + (!approved && remarks ? infoRow('Reason', esc(remarks)) : '');

    const bodyHtml =
      '<p style="margin:0 0 14px;font-size:14px;color:#334155">Dear ' + esc(ownerName) + ',</p>'
      + '<p style="margin:0 0 14px;font-size:14px;color:#334155">Your vehicle registration has been reviewed: ' + statusBadge + '</p>'
      + '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px">' + rows + '</table>'
      + (approved
        ? '<p style="margin:0;font-size:14px;color:#334155">Your QR gate pass is now active. Open GateQR and go to <b>My Vehicles</b> to view or download it.</p>'
        : '<p style="margin:0;font-size:14px;color:#334155">You may correct the issue and submit a new registration in GateQR.</p>');

    const lines = approved
      ? [
          `Dear ${ownerName},`,
          '',
          `Good news! Your vehicle registration has been APPROVED.`,
          '',
          `Plate number: ${plate}`,
          `Vehicle: ${vehicle || '—'}`,
          validUntil ? `Pass valid until: ${validUntil}` : '',
          '',
          'Your QR gate pass is now active. Open GateQR and go to "My Vehicles" to view or download it.',
          '',
          '- GateQR, NWSSU',
        ]
      : [
          `Dear ${ownerName},`,
          '',
          `Your vehicle registration has been reviewed and was NOT approved.`,
          '',
          `Plate number: ${plate}`,
          `Vehicle: ${vehicle || '—'}`,
          remarks ? `Reason: ${remarks}` : '',
          '',
          'You may correct the issue and submit a new registration in GateQR.',
          '',
          '- GateQR, NWSSU',
        ];

    await sendMail({
      to,
      subject,
      text: lines.filter(Boolean).join('\n'),
      html: brandedEmail(`Vehicle registration ${approved ? 'approved' : 'update'}`, bodyHtml),
      attachments: [logoAttachment()],
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-status-notice error:', err);
    return res.status(500).json({ error: 'Failed to send the status notification email. Please check the email configuration and try again.', detail: String(err?.message || err) });
  }
}
