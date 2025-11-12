import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Pool } from "pg";
import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

interface JobData {
  title: string;
  description: string;
  link: string;
  firma?: string;
  arbeitsort?: string;
}

async function uploadScreenshotToVercel(base64Screenshot: string): Promise<string | null> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.log("Cron job: No BLOB_READ_WRITE_TOKEN, skipping screenshot upload");
      return null;
    }

    // Convert base64 to buffer
    const base64Data = base64Screenshot.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Upload to Vercel Blob
    const blobResponse = await fetch('https://blob.vercel-storage.com/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
        'Content-Type': 'image/png',
        'x-api-version': '1',
      },
      body: buffer,
    });

    if (!blobResponse.ok) {
      throw new Error(`Failed to upload screenshot: ${blobResponse.statusText}`);
    }

    const blobData = await blobResponse.json();
    return blobData.url;
  } catch (error) {
    console.error('Failed to upload screenshot:', error);
    return null;
  }
}

async function saveActivityLog(pool: Pool, status: string, duration: number, message?: string, details?: any, screenshotUrl?: string) {
  try {
    await pool.query(`
      INSERT INTO activity_logs (status, duration, message, details, screenshot_url)
      VALUES ($1, $2, $3, $4, $5)
    `, [status, duration, message, details ? JSON.stringify(details) : null, screenshotUrl]);
  } catch (error) {
    console.error('Failed to save activity log:', error);
  }
}

async function enrichJobsInBackground(jobLinks: { link: string; title: string }[]) {
  console.log("Background enrichment: Starting for", jobLinks.length, "jobs");
  
  try {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      console.log("Background: No database connection, skipping enrichment");
      return;
    }
    
    const pool = new Pool({ connectionString, max: 1 });
    
    const browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    
    for (let i = 0; i < jobLinks.length; i++) {
      const { link: absoluteLink, title: jobTitle } = jobLinks[i];
      
      try {
        console.log(`Background: Enriching job ${i + 1}/${jobLinks.length}: ${jobTitle}`);
        
        await page.goto(absoluteLink, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.waitForTimeout(500);
        
        let jobDescription = "";
        let firma = "";
        let arbeitsort = "";
        
        // Extract job details from individual job page
        try {
          jobDescription = await page.locator('.stelle-beschreibung, .beschreibung, [data-testid="job-description"]').innerText().catch(() => "");
        } catch {}
        
        try {
          firma = await page.locator('.firma, .company-name, [data-testid="company-name"]').innerText().catch(() => "");
        } catch {}
        
        try {
          arbeitsort = await page.locator('.ort, .job-location, [data-testid="job-location"]').innerText().catch(() => "");
        } catch {}
        
        // Update job with details
        if (jobDescription || firma || arbeitsort) {
          await pool.query(
            `UPDATE jobs 
             SET description = $1, firma = $2, arbeitsort = $3 
             WHERE link = $4`,
            [jobDescription, firma || null, arbeitsort || null, absoluteLink]
          );
          console.log(`Background: Updated job with details: ${jobTitle}`);
        }
        
      } catch (e) {
        console.log(`Background: Error enriching job ${jobTitle}:`, e instanceof Error ? e.message : String(e));
      }
    }
    
    await browser.close();
    await pool.end();
    console.log("Background enrichment: Completed");
    
  } catch (error) {
    console.error('Background enrichment failed:', error);
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  const startTime = Date.now();
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

    // Create activity_logs table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        status VARCHAR(20) NOT NULL,
        duration INTEGER NOT NULL,
        message TEXT,
        details JSONB,
        screenshot_url TEXT
      );
    `);

    console.log("Cron job: Getting random active job link...");
    // Get random active job link
    const linksResult = await pool.query(
      `SELECT id, url, title FROM job_links WHERE active = true ORDER BY RANDOM() LIMIT 1`
    );

    console.log("Cron job: Found", linksResult.rows.length, "active links");

    if (linksResult.rows.length === 0) {
      await pool.end();
      const duration = Date.now() - startTime;
      await saveActivityLog(pool, 'ERROR', duration, 'No active job links found');
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

    console.log("Cron job: Starting playwright scraping...");
    
    // Direct scraping instead of calling API
    const browser = await playwrightChromium.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    
    console.log("Cron job: Navigating to:", selectedLink.url);
    await page.goto(selectedLink.url, { waitUntil: 'networkidle' });
    
    // Take screenshot for debugging and upload to Vercel Blob
    const screenshot = await page.screenshot({ encoding: 'base64' });
    console.log("Cron job: Page screenshot taken (length:", screenshot.length, ")");
    
    let screenshotUrl: string | null = null;
    try {
      screenshotUrl = await uploadScreenshotToVercel(`data:image/png;base64,${screenshot}`);
      if (screenshotUrl) {
        console.log("Cron job: Screenshot uploaded to:", screenshotUrl);
      }
    } catch (screenshotError) {
      console.log("Cron job: Screenshot upload failed, continuing without screenshot:", screenshotError instanceof Error ? screenshotError.message : String(screenshotError));
      // Continue normally even if screenshot upload fails
    }
    
    // Get page title and URL to confirm we're on the right page
    const pageTitle = await page.title();
    const pageUrl = page.url();
    console.log("Cron job: Page title:", pageTitle);
    console.log("Cron job: Current URL:", pageUrl);
    
    console.log("Cron job: Extracting job data...");
    
    let jobLinks: { link: string; title: string }[] = [];
    let currentPage = 1;
    const maxPages = 3; // Limit to 3 pages to avoid timeout
    
    while (currentPage <= maxPages) {
      console.log(`Cron job: Processing page ${currentPage}...`);
      
      // First, get all job links from the current page
      const jobItemsLocator = page.locator('a[id^="ergebnisliste-item-"]');
      await jobItemsLocator.first().waitFor({ timeout: 10000 }).catch(() => {});
      const jobElements = await jobItemsLocator.all();
      console.log("Cron job: Found", jobElements.length, "job elements on page", currentPage);
      
      if (jobElements.length === 0) {
        console.log("Cron job: No more jobs found, stopping pagination");
        break;
      }
      
      for (let i = 0; i < jobElements.length; i++) {
        const jobElement = jobElements[i];
        const jobLink = await jobElement.getAttribute("href").catch(() => null);
        let jobTitle = await jobElement.locator("h3").innerText().catch(() => "Titel nicht verfügbar");
        jobTitle = jobTitle.replace(/^\d+\.\s*Ergebnis\s*/, "").replace(/^:\s*/, "").trim();
        if (jobLink) {
          jobLinks.push({ 
            link: new URL(jobLink, selectedLink.url).toString(), 
            title: jobTitle 
          });
        }
      }
      
      // Try to go to next page
      const nextButton = page.locator('a[title="Nächste Seite"], .pagination-next, [data-testid="next-page"]');
      const hasNextPage = await nextButton.isVisible().catch(() => false);
      
      if (!hasNextPage) {
        console.log("Cron job: No next page found, stopping pagination");
        break;
      }
      
      console.log("Cron job: Going to next page...");
      await nextButton.click();
      await page.waitForTimeout(1000);
      currentPage++;
    }
    
    console.log("Cron job: Extracted", jobLinks.length, "total job links from", currentPage - 1, "pages");
    
    // Quick save basic jobs first (title + link only)
    const quickJobs: JobData[] = jobLinks.map(({ link, title }) => ({
      title,
      link,
      description: '',
      firma: undefined,
      arbeitsort: undefined
    }));
    
    // Save basic jobs to database immediately
    let savedJobs = 0;
    for (const job of quickJobs) {
      try {
        await pool.query(
          `INSERT INTO jobs (title, description, link, firma, arbeitsort) 
           VALUES ($1, $2, $3, $4, $5) 
           ON CONFLICT (link) DO NOTHING`,
          [job.title, job.description, job.link, job.firma, job.arbeitsort]
        );
        savedJobs++;
      } catch (error) {
        console.warn('Error saving quick job:', error);
      }
    }
    
    console.log("Cron job: Quick-saved", savedJobs, "basic jobs");
    
    // Now enrich with details in background (non-blocking for response)
    enrichJobsInBackground(jobLinks.slice(0, 10)); // Limit to first 10 for performance

    await browser.close();
    
    const duration = Date.now() - startTime;
    const details = {
      scrapedLink: selectedLink,
      jobsFound: jobLinks.length,
      jobsSaved: savedJobs,
      pagesProcessed: currentPage - 1,
      jobLinksFound: jobLinks.length,
      mode: 'async'
    };
    
    await saveActivityLog(pool, 'SUCCESS', duration, 'Successfully scraped jobs (async mode)', details, screenshotUrl);
    
    await pool.end();
    
    response.status(200).json({ 
      success: true, 
      scrapedLink: selectedLink,
      jobsFound: jobLinks.length,
      jobsSaved: savedJobs,
      message: `Quick-scraped ${jobLinks.length} job links, enriching details in background`
    });
    
  } catch (error) {
    console.error("Cron handler error:", error);
    console.error("Cron handler error stack:", (error as Error).stack);
    
    const duration = Date.now() - startTime;
    // Try to save error log even if pool is not available
    try {
      const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
      if (connectionString) {
        const pool = new Pool({ connectionString, max: 1 });
        await saveActivityLog(pool, 'ERROR', duration, (error as Error).message, { stack: (error as Error).stack });
        await pool.end();
      }
    } catch (logError) {
      console.error('Failed to save error log:', logError);
    }
    
    response
      .status(500)
      .json({ 
        success: false, 
        error: (error as Error).message,
        stack: (error as Error).stack
      });
  }
}
