// Shared outbound mail for GateQR serverless functions.
// Prefers Resend (RESEND_API_KEY) so notifications come from a GateQR mailbox
// instead of a personal Gmail account — with Gmail SMTP, recipients see the
// Google profile photo of whoever owns SMTP_USER. If Resend is not configured
// OR the send fails (e.g. unverified domain on the free tier can only mail the
// account owner's own address), falls back to SMTP when SMTP_* is configured.
//
// Resend env vars (Vercel -> Settings -> Environment Variables):
//   RESEND_API_KEY   from https://resend.com/api-keys
//   RESEND_FROM      (optional) defaults to "GateQR - NWSSU <onboarding@resend.dev>"
//                    — set to your verified domain once you have one
// SMTP fallback env vars: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM

import nodemailer from 'nodemailer';
import { Resend } from 'resend';

const FROM_NAME = 'GateQR - NWSSU';

export function mailConfigError() {
  const env = process.env;
  if (env.RESEND_API_KEY) return null;
  if (env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS) return null;
  return 'Email is not configured on the server. Set RESEND_API_KEY (recommended) or SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in Vercel environment variables.';
}

// attachments: [{ filename, content (Buffer), contentType, cid }]
export async function sendMail({ to, subject, text, html, attachments = [] }) {
  const env = process.env;

  const smtpConfigured = env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS;

  if (env.RESEND_API_KEY) {
    try {
      const resend = new Resend(env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: env.RESEND_FROM || `${FROM_NAME} <onboarding@resend.dev>`,
        to,
        subject,
        text,
        html,
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
          contentId: a.cid,
        })),
      });
      if (!error) return;
      if (!smtpConfigured) throw new Error(`[resend] ${error.message}`);
      console.error(`Resend failed (${error.message}); falling back to SMTP`);
    } catch (e) {
      if (!smtpConfigured) throw e;
      console.error(`Resend failed (${e?.message || e}); falling back to SMTP`);
    }
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: env.SMTP_SECURE === 'true' || Number(env.SMTP_PORT) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  const fromAddr = env.SMTP_FROM || env.SMTP_USER;
  const from = /</.test(fromAddr) ? fromAddr : `${FROM_NAME} <${fromAddr}>`;

  try {
    await transporter.sendMail({ from, to, subject, text, html, attachments });
  } catch (e) {
    throw new Error(`[smtp] ${e?.message || e}`);
  }
}
