import { Pool } from "pg";

export default async function handler(req: any, res: any) {
  try {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      return res.status(500).json({ error: "POSTGRES_URL is not set", jobs: [] });
    }
    const pool = new Pool({ connectionString, max: 1 });

    // ensure table exists
    await pool.query(`
      create table if not exists jobs (
        id bigserial primary key,
        title text not null,
        description text,
        link text not null unique,
        firma text,
        arbeitsort text,
        created_at timestamptz not null default now()
      );
    `);

    const result = await pool.query(
      `select title, description, link, firma, arbeitsort
       from jobs
       order by created_at desc, id desc`
    );

    await pool.end();

    return res.status(200).json({ jobs: result.rows });
  } catch (error: any) {
    console.error("list-jobs error", error);
    return res.status(500).json({ error: error?.message || String(error), jobs: [] });
  }
}