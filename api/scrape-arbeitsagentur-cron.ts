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
    
    // Take screenshot for debugging
    const screenshot = await page.screenshot({ encoding: 'base64' });
    console.log("Cron job: Page screenshot taken (length:", screenshot.length, ")");
    
    // Get page title and URL to confirm we're on the right page
    const pageTitle = await page.title();
    const pageUrl = page.url();
    console.log("Cron job: Page title:", pageTitle);
    console.log("Cron job: Current URL:", pageUrl);
    
    console.log("Cron job: Extracting job data...");
    
    // First, get all job links from the list page
    const jobItemsLocator = page.locator('a[id^="ergebnisliste-item-"]');
    await jobItemsLocator.first().waitFor({ timeout: 10000 }).catch(() => {});
    const jobElements = await jobItemsLocator.all();
    console.log("Cron job: Found", jobElements.length, "job elements");
    
    let jobLinks: { link: string; title: string }[] = [];
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
    
    console.log("Cron job: Extracted", jobLinks.length, "job links");
    
    const jobs: JobData[] = [];
    
    // Now visit each job page to get details
    for (let i = 0; i < Math.min(jobLinks.length, 10); i++) { // Limit to 10 jobs to avoid timeout
      const { link: absoluteLink, title: jobTitle } = jobLinks[i];
      console.log(`Cron job: Processing job ${i + 1}/${jobLinks.length}: ${jobTitle}`);
      
      try {
        await page.goto(absoluteLink, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(1200);
        
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
        
        jobs.push({
          title: jobTitle,
          description: jobDescription,
          link: absoluteLink,
          firma: firma || undefined,
          arbeitsort: arbeitsort || undefined
        });
        
        console.log(`Cron job: Extracted job: ${jobTitle}`);
        
      } catch (e) {
        console.log(`Cron job: Error processing job ${jobTitle}:`, e instanceof Error ? e.message : String(e));
      }
    }

    await browser.close();
    console.log("Cron job: Extracted", jobs.length, "jobs");

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

    await pool.end();
    console.log("Cron job: Saved", savedJobs, "new jobs to database");
    
    response.status(200).json({ 
      success: true, 
      scrapedLink: selectedLink,
      jobsFound: jobs.length,
      jobsSaved: savedJobs
    });
    
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
