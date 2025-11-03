import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const bodyRaw = (req as any).body;
    const body = typeof bodyRaw === 'string' ? JSON.parse(bodyRaw) : bodyRaw;
    const smtp = body?.smtp || {};

    if (!smtp?.host || !smtp?.port) {
      return res.status(400).json({ ok: false, error: 'Missing SMTP host or port' });
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port),
      secure: Boolean(smtp.secure),
      auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
    });

    await transporter.verify();
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err?.message || 'SMTP verification failed' });
  }
}

