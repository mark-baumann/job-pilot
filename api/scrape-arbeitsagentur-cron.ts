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

async function saveActivityLog(pool: Pool, status: string, duration: number, message?: string, details?: any) {
  try {
    await pool.query(`
      INSERT INTO activity_logs (status, duration, message, details)
      VALUES ($1, $2, $3, $4)
    `, [status, duration, message, details ? JSON.stringify(details) : null]);
  } catch (error) {
    console.error('Failed to save activity log:', error);
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
        details JSONB
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
      args: [
        ...chromium.args, 
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    
    // Optimize page for maximum speed
    await page.route('**/*.{png,jpg,jpeg,gif,svg,css,font,woff,woff2}', route => route.abort());
    await page.setViewportSize({ width: 1280, height: 720 });
    
    console.log("Cron job: Navigating to:", selectedLink.url);
    await page.goto(selectedLink.url, { waitUntil: 'networkidle' });
    
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
    
    // Random limit between 1 and 15 jobs for variety
    const maxJobsToProcess = Math.floor(Math.random() * 15) + 1; // 1-15
    const jobsToProcess = jobLinks.slice(0, Math.min(maxJobsToProcess, jobLinks.length));
    console.log("Cron job: Processing", jobsToProcess.length, "jobs (random limit:", maxJobsToProcess, ")");
    
    const jobs: JobData[] = [];
    const addedJobs: any[] = []; // Track jobs that were actually added
    
    // Visit each job page to get details (synchronous mode)
    for (let i = 0; i < jobsToProcess.length; i++) {
      const { link: absoluteLink, title: jobTitle } = jobsToProcess[i];
      console.log(`Cron job: Processing job ${i + 1}/${jobsToProcess.length}: ${jobTitle}`);
      
      try {
        await page.goto(absoluteLink, { waitUntil: "domcontentloaded", timeout: 8000 });
        await page.waitForTimeout(100); // Minimal wait
        
        let jobDescription = "";
        let firma = "";
        let arbeitsort = "";
        
        // Extract job details using new XPath selectors
        try {
          jobDescription = await page.locator('//*[@id="detail-beschreibung-beschreibung"]').first().innerText({ timeout: 2000 }).catch(() => "");
        } catch {}
        
        try {
          firma = await page.locator('.firma, .company-name, [data-testid="company-name"]').first().innerText({ timeout: 2000 }).catch(() => "");
        } catch {}
        
        try {
          arbeitsort = await page.locator('//*[@id="detail-kopfbereich-arbeitsort"]').first().innerText({ timeout: 2000 }).catch(() => "");
        } catch {}
        
        // Only add job if it has a description (using new XPath)
        if (jobDescription && jobDescription.trim().length > 50) {
          jobs.push({
            title: jobTitle,
            description: jobDescription,
            link: absoluteLink,
            firma: firma || undefined,
            arbeitsort: arbeitsort || undefined
          });
          
          addedJobs.push({
            title: jobTitle,
            link: absoluteLink,
            firma: firma || undefined,
            arbeitsort: arbeitsort || undefined
          });
          
          console.log(`Cron job: ✅ Added job with description: ${jobTitle}`);
        } else {
          console.log(`Cron job: ❌ Skipped job - no description: ${jobTitle}`);
        }
        
      } catch (e) {
        console.log(`Cron job: Error processing job ${jobTitle}:`, e instanceof Error ? e.message : String(e));
      }
    }

    await browser.close();
    console.log("Cron job: Extracted", jobs.length, "jobs with details");

    // Save jobs to database
    let savedJobs = 0;
    for (const job of jobs) {
      try {
        await pool.query(
          `INSERT INTO jobs (title, description, link, firma, arbeitsort) 
           VALUES ($1, $2, $3, $4, $5) 
           ON CONFLICT (link) DO NOTHING`,
          [job.title, job.description, job.link, job.firma, job.arbeitsort]
        );
        savedJobs++;
      } catch (error) {
        console.warn('Error saving job:', error);
      }
    }
    
    console.log("Cron job: Saved", savedJobs, "new jobs to database");
    
    const duration = Date.now() - startTime;
    const details = {
      scrapedLink: selectedLink.url,
      jobsFound: jobs.length,
      jobsSaved: savedJobs,
      pagesProcessed: currentPage - 1,
      jobLinksFound: jobLinks.length,
      jobsProcessed: jobsToProcess.length,
      addedJobs: addedJobs, // Jobs that were actually added
      skippedJobs: jobsToProcess.length - jobs.length, // Jobs without descriptions
      mode: 'synchronous'
    };
    
    await saveActivityLog(pool, 'SUCCESS', duration, 'Successfully scraped jobs with full details', details);
    
    await pool.end();
    
    response.status(200).json({ 
      success: true, 
      scrapedLink: selectedLink,
      jobsFound: jobs.length,
      jobsSaved: savedJobs,
      message: `Successfully scraped ${jobs.length} jobs with full details from ${jobLinks.length} links`
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
