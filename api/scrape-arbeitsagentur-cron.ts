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
    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll('.resultitem, .job-item, [data-href*="/jobsuche/"], .job-list-item');
      const extractedJobs: JobData[] = [];
      
      console.log('Found job elements:', jobElements.length);
      
      jobElements.forEach((element, index) => {
        try {
          // Try multiple selectors for title
          const titleElement = element.querySelector('h3 a, h2 a, .titel a, .job-title a, [data-testid="job-title"] a, .resultitem-headline a') ||
                             element.querySelector('h3, h2, .titel, .job-title, [data-testid="job-title"], .resultitem-headline');
          
          // Try multiple selectors for link
          const linkElement = element.querySelector('a[href*="/jobsuche/"], a[href*="/job/"], .resultitem-headline a, .titel a');
          
          // Try multiple selectors for description
          const descriptionElement = element.querySelector('.beschreibung, .job-description, p, .description, .resultitem-beschreibung');
          
          // Try multiple selectors for company
          const companyElement = element.querySelector('.firma, .company-name, [data-testid="company-name"], .resultitem-firma');
          
          // Try multiple selectors for location
          const locationElement = element.querySelector('.ort, .job-location, [data-testid="job-location"], .resultitem-ort');
          
          const title = titleElement?.textContent?.trim() || '';
          const link = (linkElement as HTMLAnchorElement)?.href || '';
          const description = descriptionElement?.textContent?.trim() || '';
          const firma = companyElement?.textContent?.trim() || undefined;
          const arbeitsort = locationElement?.textContent?.trim() || undefined;
          
          console.log(`Job ${index}: title="${title}", link="${link}"`);
          
          if (title && link) {
            extractedJobs.push({
              title,
              description,
              link,
              firma,
              arbeitsort
            });
          }
        } catch (error) {
          console.warn('Error extracting job:', error);
        }
      });
      
      return extractedJobs;
    });

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
