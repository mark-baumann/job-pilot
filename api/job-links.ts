import { Pool } from "pg";

export default async function handler(req: any, res: any) {
  try {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      return res.status(500).json({ error: "POSTGRES_URL is not set" });
    }
    const pool = new Pool({ connectionString, max: 1 });

    // Create job_links table if not exists
    await pool.query(`
      create table if not exists job_links (
        id bigserial primary key,
        url text not null unique,
        title text,
        active boolean not null default true,
        created_at timestamptz not null default now(),
        last_used timestamptz
      );
    `);

    if (req.method === 'GET') {
      // Get all job links
      const result = await pool.query(
        `select id, url, title, active, created_at, last_used
         from job_links
         order by created_at desc`
      );
      
      await pool.end();
      return res.status(200).json({ links: result.rows });
    }

    if (req.method === 'POST') {
      // Add new job link
      const { url, title } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      const result = await pool.query(
        `insert into job_links (url, title) 
         values ($1, $2) 
         on conflict (url) do update set 
           title = excluded.title,
           active = true
         returning *`,
        [url, title || null]
      );
      
      await pool.end();
      return res.status(201).json({ link: result.rows[0] });
    }

    if (req.method === 'PUT') {
      // Update job link (activate/deactivate)
      const { id, active } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'ID is required' });
      }

      await pool.query(
        `update job_links set active = $1, last_used = now() where id = $2`,
        [active !== undefined ? active : true, id]
      );
      
      await pool.end();
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      // Delete job link
      const { id } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'ID is required' });
      }

      await pool.query(`delete from job_links where id = $1`, [id]);
      
      await pool.end();
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);

  } catch (error: any) {
    console.error("job-links API error:", error);
    res.status(500).json({ error: error?.message || "Unknown error" });
  }
}
