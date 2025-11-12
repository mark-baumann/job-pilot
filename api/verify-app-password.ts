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

    console.log('Request body:', req.body);
    
    let password;
    try {
      if (typeof req.body === 'string') {
        password = JSON.parse(req.body).password;
      } else if (req.body && typeof req.body === 'object') {
        password = req.body.password;
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    
    if (!password) {
      console.error('No password provided in body:', req.body);
      return res.status(400).json({ error: 'Password is required' });
    }
    
    const isValid = verifyAppPassword(password);
    console.log('Password validation result:', isValid);
    
    return res.status(200).json({ valid: isValid });
  } catch (error) {
    console.error('Password verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
