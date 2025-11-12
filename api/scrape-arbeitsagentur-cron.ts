import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (
    request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return response.status(401).end("Unauthorized");
  }

  try {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      return response.status(500).json({ success: false, error: "POSTGRES_URL is not set" });
    }
    
    const pool = new Pool({ connectionString, max: 1 });

    // Get random active job link
    const linksResult = await pool.query(
      `SELECT id, url, title FROM job_links WHERE active = true ORDER BY RANDOM() LIMIT 1`
    );

    if (linksResult.rows.length === 0) {
      await pool.end();
      return response.status(400).json({ success: false, error: "No active job links found" });
    }

    const selectedLink = linksResult.rows[0];
    
    // Update last_used for the selected link
    await pool.query(
      `UPDATE job_links SET last_used = now() WHERE id = $1`,
      [selectedLink.id]
    );

    await pool.end();

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    
    const scrapeResponse = await fetch(`${baseUrl}/api/scrape-arbeitsagentur`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: selectedLink.url }),
    });

    if (!scrapeResponse.ok) {
      throw new Error("Failed to trigger scrape");
    }

    const result = await scrapeResponse.json();
    response.status(200).json({ 
      success: true, 
      scrapedLink: selectedLink,
      result 
    });
  } catch (error) {
    console.error("Cron handler error:", error);
    response
      .status(500)
      .json({ success: false, error: (error as Error).message });
  }
}
