import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  console.log("Cron job: Starting...");
  
  if (
    request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    console.log("Cron job: Unauthorized - missing or wrong secret");
    return response.status(401).end("Unauthorized");
  }

  try {
    console.log("Cron job: Authenticated, connecting to database...");
    
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      console.log("Cron job: No database connection string found");
      return response.status(500).json({ success: false, error: "POSTGRES_URL is not set" });
    }
    
    const pool = new Pool({ connectionString, max: 1 });

    console.log("Cron job: Getting random active job link...");
    // Get random active job link
    const linksResult = await pool.query(
      `SELECT id, url, title FROM job_links WHERE active = true ORDER BY RANDOM() LIMIT 1`
    );

    console.log("Cron job: Found", linksResult.rows.length, "active links");

    if (linksResult.rows.length === 0) {
      await pool.end();
      console.log("Cron job: No active links found");
      return response.status(400).json({ success: false, error: "No active job links found" });
    }

    const selectedLink = linksResult.rows[0];
    console.log("Cron job: Selected link:", selectedLink);
    
    // Update last_used for the selected link
    await pool.query(
      `UPDATE job_links SET last_used = now() WHERE id = $1`,
      [selectedLink.id]
    );

    await pool.end();

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    
    console.log("Cron job: Base URL:", baseUrl);
    
    const scrapeUrl = `${baseUrl}/api/scrape-arbeitsagentur`;
    console.log("Cron job: Calling scrape API:", scrapeUrl);
    
    try {
      const scrapeResponse = await fetch(scrapeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: selectedLink.url }),
      });

      console.log("Cron job: Scrape response status:", scrapeResponse.status);
      
      if (!scrapeResponse.ok) {
        const errorText = await scrapeResponse.text();
        console.log("Cron job: Scrape error response:", errorText);
        throw new Error(`Failed to trigger scrape: ${scrapeResponse.status} - ${errorText}`);
      }

      const result = await scrapeResponse.json();
      console.log("Cron job: Scrape success:", result);
      
      response.status(200).json({ 
        success: true, 
        scrapedLink: selectedLink,
        result 
      });
    } catch (fetchError) {
      console.log("Cron job: Fetch error:", fetchError);
      throw new Error(`Fetch failed: ${(fetchError as Error).message}`);
    }
  } catch (error) {
    console.error("Cron handler error:", error);
    console.error("Cron handler error stack:", (error as Error).stack);
    response
      .status(500)
      .json({ 
        success: false, 
        error: (error as Error).message,
        stack: (error as Error).stack 
      });
  }
}
