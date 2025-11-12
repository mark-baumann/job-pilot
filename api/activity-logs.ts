import { Pool } from "pg";

interface CronLog {
  id: string;
  createdAt: string;
  status: "SUCCESS" | "ERROR" | "TIMEOUT";
  duration: number;
  message?: string;
  details?: any;
  screenshot?: string;
}

export default async function handler(
  request: any,
  response: any
) {
  try {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      return response.status(500).json({ success: false, error: "DATABASE_URL is not set" });
    }
    
    const pool = new Pool({ connectionString, max: 1 });

    // Create activity_logs table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        status VARCHAR(20) NOT NULL,
        duration INTEGER NOT NULL,
        message TEXT,
        details JSONB
      );
    `);

    // Get recent logs
    const result = await pool.query(`
      SELECT * FROM activity_logs 
      ORDER BY created_at DESC 
      LIMIT 50
    `);

    await pool.end();

    const logs: CronLog[] = result.rows.map(row => ({
      id: row.id,
      createdAt: row.created_at,
      status: row.status,
      duration: row.duration,
      message: row.message,
      details: row.details
    }));

    response.status(200).json({ 
      success: true, 
      logs,
      count: logs.length
    });
    
  } catch (error) {
    console.error("Activity logs error:", error);
    response
      .status(500)
      .json({ 
        success: false, 
        error: (error as Error).message 
      });
  }
}
