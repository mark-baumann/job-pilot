import crypto from 'crypto';

function verifyAppPassword(password: string): boolean {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(appPassword));
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { password } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    const isValid = verifyAppPassword(password);
    
    return res.status(200).json({ valid: isValid });
  } catch (error) {
    console.error('Password verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
