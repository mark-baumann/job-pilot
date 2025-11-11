import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";
import { kv } from "@vercel/kv";

interface JobData {
  title: string;
  description: string;
  link: string;
  firma?: string;
  arbeitsort?: string;
}

interface CacheData {
  timestamp: number;
  jobs: JobData[];
}

async function scrapeAllJobs(): Promise<JobData[]> {
  let browser = null;
  const jobs: JobData[] = [];

  try {
    const executablePath = await chromium.executablePath();
    if (typeof executablePath !== "string") {
      throw new Error(
        `Invalid executablePath, expected string but got ${typeof executablePath}`
      );
    }

    browser = await playwrightChromium.launch({
      args: (chromium as any).args || [],
      executablePath: executablePath,
      headless: (chromium as any).headless ?? true,
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    const targetUrl =
      "https://www.arbeitsagentur.de/jobsuche/suche?berufsfeld=Softwareentwicklung%20und%20Programmierung&angebotsart=1&wo=85256%20Vierkirchen,%20Oberbayern&umkreis=25";

    console.log("Scraping: Loading page...");
    try {
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
    } catch (e) {
      console.warn("Timeout beim Laden der Seite, versuche weiterzumachen...");
    }

    // Cookie-Dialog wegklicken
    console.log("Scraping: Closing cookie dialog...");
    try {
      const acceptButton = page.getByTestId(
        "bahf-cookie-disclaimer-btn-alle"
      );
      const isVisible = await acceptButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (isVisible) {
        await acceptButton.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      console.log("Cookie-Dialog nicht gefunden oder bereits geschlossen");
    }

    // Jobs laden
    console.log("Scraping: Loading jobs...");
    try {
      const jobItemsLocator = page.locator('a[id^="ergebnisliste-item-"]');
      await jobItemsLocator
        .first()
        .waitFor({ timeout: 10000 })
        .catch(() => {});
      const jobElements = await jobItemsLocator.all();

      console.log(`Scraping: Found ${jobElements.length} jobs`);

      // Sammle zuerst alle Job-Links und Titel
      const jobLinks: { link: string; title: string }[] = [];
      for (let i = 0; i < jobElements.length; i++) {
        const jobElement = jobElements[i];
        const jobLink = await jobElement
          .getAttribute("href")
          .catch(() => null);
        let jobTitle = await jobElement
          .locator("h3")
          .innerText()
          .catch(() => "Titel nicht verfügbar");

        jobTitle = jobTitle
          .replace(/^\d+\.\s*Ergebnis\s*/, "")
          .replace(/^:\s*/, "")
          .trim();

        if (jobLink) {
          jobLinks.push({
            link: new URL(jobLink, targetUrl).toString(),
            title: jobTitle,
          });
        }
      }

      // Gehe durch alle Jobs und extrahiere Daten
      console.log(`Scraping: Processing ${jobLinks.length} jobs...`);
      for (let i = 0; i < jobLinks.length; i++) {
        const { link: absoluteLink, title: jobTitle } = jobLinks[i];

        console.log(`Scraping: Processing job ${i + 1}/${jobLinks.length}`);

        try {
          await page.goto(absoluteLink, {
            waitUntil: "domcontentloaded",
            timeout: 20000,
          });
        } catch (e) {
          console.warn("Timeout beim Laden der Job-Seite");
        }

        await page.waitForTimeout(1500);

        let jobDescription = "";
        let firma = "";
        let arbeitsort = "";

        // Extrahiere Beschreibung
        try {
          const descElement = page.locator(
            'xpath=//*[@id="detail-beschreibung-beschreibung"]'
          );
          await descElement.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(500);

          const isVisible = await descElement
            .isVisible({ timeout: 3000 })
            .catch(() => false);
          if (isVisible) {
            jobDescription = await descElement
              .innerText({ timeout: 3000 })
              .catch(() => "");
          }
        } catch (e) {
          console.log("Beschreibung nicht mit XPath gefunden");
        }

        // Fallback für Beschreibung
        if (!jobDescription || jobDescription.length < 50) {
          try {
            const descElement = page
              .locator("div[class*='beschreibung']")
              .first();
            jobDescription = await descElement
              .innerText({ timeout: 2000 })
              .catch(() => "");
          } catch (e) {
            // pass
          }
        }

        // Extrahiere Firma
        try {
          const firmaElement = page.locator(
            'xpath=//*[@id="detail-kopfbereich-firma"]'
          );
          await firmaElement.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(300);

          const isVisible = await firmaElement
            .isVisible({ timeout: 2000 })
            .catch(() => false);
          if (isVisible) {
            firma = await firmaElement
              .innerText({ timeout: 3000 })
              .catch(() => "");
            firma = firma
              .replace(/^Arbeitgeber:\s*/, "")
              .replace(/^:\s*/, "")
              .trim();
          }
        } catch (e) {
          console.log("Firma nicht mit XPath gefunden");
        }

        // Extrahiere Arbeitsort
        try {
          const arbeitsortElement = page.locator(
            'xpath=//*[@id="detail-kopfbereich-arbeitsort"]'
          );
          await arbeitsortElement.scrollIntoViewIfNeeded().catch(() => {});
          await page.waitForTimeout(300);

          const isVisible = await arbeitsortElement
            .isVisible({ timeout: 2000 })
            .catch(() => false);
          if (isVisible) {
            arbeitsort = await arbeitsortElement
              .innerText({ timeout: 3000 })
              .catch(() => "");
            arbeitsort = arbeitsort.replace(/^:\s*/, "").trim();
          }
        } catch (e) {
          console.log("Arbeitsort nicht mit XPath gefunden");
        }

        const jobData: JobData = {
          title: jobTitle,
          description: jobDescription.trim(),
          link: absoluteLink,
          firma: firma.trim(),
          arbeitsort: arbeitsort.trim(),
        };

        jobs.push(jobData);
      }

      console.log(`Scraping: Successfully scraped ${jobs.length} jobs`);
    } catch (e) {
      console.error("Fehler beim Scrapen der Jobs:", e);
    }

    await context.close();
  } catch (error) {
    console.error("Scraping error:", error);
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error("Error closing browser:", e);
      }
    }
  }

  return jobs;
}

export default async function handler(req: any, res: any) {
  try {
    console.log("Manual scrape job started...");
    const jobs = await scrapeAllJobs();

    const timestamp = Date.now();
    const cacheData: CacheData = {
      timestamp,
      jobs,
    };

    // Save snapshot under a timestamped key and update an index list
    const snapshotKey = `jobs-cache:${timestamp}`;
    await kv.set(snapshotKey, JSON.stringify(cacheData));

    // Update latest pointer for backward compatibility
    await kv.set("jobs-cache", JSON.stringify(cacheData));

    try {
      const existing = await kv.get("jobs-cache-index");
      const index = typeof existing === "string" ? JSON.parse(existing) : existing || [];
      // Prepend new snapshot metadata
      const meta = { timestamp, count: jobs.length };
      const next = [meta, ...(Array.isArray(index) ? index : [])].slice(0, 50); // keep last 50
      await kv.set("jobs-cache-index", JSON.stringify(next));
    } catch (e) {
      console.warn("Failed to update jobs-cache-index", e);
    }

    console.log(`Manual scrape job completed: ${jobs.length} jobs saved to KV (${snapshotKey})`);

    res.status(200).json({
      success: true,
      message: `Scraping completed: ${jobs.length} jobs saved`,
      timestamp,
    });
  } catch (error) {
    console.error("Manual scrape job error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}