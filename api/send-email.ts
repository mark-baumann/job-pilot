import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

type AttachmentIn = {
  filename?: string;
  contentType?: string;
  base64: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const bodyRaw = (req as any).body;
    const body = typeof bodyRaw === 'string' ? JSON.parse(bodyRaw) : bodyRaw;
    const smtp = body?.smtp || {};
    const mail = body?.mail || {};

    if (!smtp?.host || !smtp?.port) {
      return res.status(400).json({ ok: false, error: 'Missing SMTP host or port' });
    }
    if (!mail?.to) {
      return res.status(400).json({ ok: false, error: 'Missing mail.to' });
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port),
      secure: Boolean(smtp.secure),
      auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
    });

    const attachments = Array.isArray(mail.attachments)
      ? (mail.attachments as AttachmentIn[]).map((a) => ({
          filename: a.filename || 'attachment',
          content: Buffer.from(a.base64, 'base64'),
          contentType: a.contentType || 'application/octet-stream',
        }))
      : undefined;

    const info = await transporter.sendMail({
      from: mail.from,
      to: mail.to,
      cc: mail.cc,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments,
    });

    return res.status(200).json({ ok: true, id: info.messageId, accepted: info.accepted, rejected: info.rejected });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'Send failed' });
  }
}

