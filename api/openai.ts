import { Pool } from "pg";
import crypto from "crypto";

async function getPool() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL (or DATABASE_URL) is not set");
  }
  const pool = new Pool({ connectionString, max: 1 });
  // Ensure table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id BIGSERIAL PRIMARY KEY,
      service TEXT NOT NULL,
      key_value TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(service, key_value)
    );
  `);
  return pool;
}

function verifyAppPassword(password: string): boolean {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(password), Buffer.from(appPassword));
}

export default async function handler(req: any, res: any) {
  let pool;
  try {
    // Verify APP_PASSWORD for all operations
    const providedPassword = req.headers['x-app-password'] || req.query.password;
    if (!providedPassword || !verifyAppPassword(providedPassword)) {
      return res.status(401).json({ error: 'Unauthorized - invalid APP_PASSWORD' });
    }

    pool = await getPool();

    if (req.method === 'GET') {
      const result = await pool.query(
        `SELECT id, key_value FROM api_keys WHERE service = 'openai' ORDER BY created_at ASC`
      );
      return res.status(200).json({ keys: result.rows });
    }

    if (req.method === 'POST') {
      const { key } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!key || typeof key !== 'string') {
        return res.status(400).json({ error: 'Key is required' });
      }
      const result = await pool.query(
        `INSERT INTO api_keys (service, key_value) VALUES ('openai', $1) ON CONFLICT (service, key_value) DO NOTHING RETURNING id, key_value`,
        [key]
      );
      return res.status(201).json({ added: result.rows[0] });
    }

    if (req.method === 'DELETE') {
      const { id } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!id) {
        return res.status(400).json({ error: 'Key ID is required' });
      }
      await pool.query(
        `DELETE FROM api_keys WHERE id = $1 AND service = 'openai'`,
        [id]
      );
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);

  } catch (error: any) {
    console.error("OpenAI keys API error:", error);
    return res.status(500).json({ error: error?.message || "Unknown error" });
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}
