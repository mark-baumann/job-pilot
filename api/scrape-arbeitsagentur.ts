import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";
import { Pool } from "pg";

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

function parseLimit(req: any): number | null {
  try {
    const url = req.url ? new URL(req.url, "http://localhost") : null;
    const raw = req.query?.limit ?? (url ? url.searchParams.get("limit") : null);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  } catch {
    return null;
  }
}

function isSSE(req: any): boolean {
  const accept = (req.headers?.accept || "").toLowerCase();
  return accept.includes("text/event-stream") || req.method === "GET";
}

function sseWrite(res: any, payload: any) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function getPool() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL (or DATABASE_URL) is not set");
  }
  const pool = new Pool({ connectionString, max: 1 });
  // Ensure table exists
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
  return pool;
}

async function scrapeAndPersist({ limitNew, onEvent }: {
  limitNew: number | null;
  onEvent: (e: any) => void;
}): Promise<{ processed: number; inserted: number; skipped: number; jobs: JobData[]; }> {
  let browser: any = null;
  const jobs: JobData[] = [];
  const pool = await getPool();

  try {
    const executablePath = await chromium.executablePath();
    if (typeof executablePath !== "string") {
      throw new Error(`Invalid executablePath, expected string but got ${typeof executablePath}`);
    }

    browser = await playwrightChromium.launch({
      args: (chromium as any).args || [],
      executablePath,
      headless: (chromium as any).headless ?? true,
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    const targetUrl = "https://www.arbeitsagentur.de/jobsuche/suche?berufsfeld=Softwareentwicklung%20und%20Programmierung&angebotsart=1&wo=85256%20Vierkirchen,%20Oberbayern&umkreis=25";

    onEvent({ type: "step", step: 1, message: "Lade Suchseite..." });
    try {
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
    } catch {
      // continue
    }

    onEvent({ type: "step", step: 2, message: "Cookie-Hinweis schließen..." });
    try {
      const acceptButton = page.getByTestId("bahf-cookie-disclaimer-btn-alle");
      const isVisible = await acceptButton.isVisible({ timeout: 5000 }).catch(() => false);
      if (isVisible) {
        await acceptButton.click();
        await page.waitForTimeout(800);
      }
    } catch {}

    onEvent({ type: "step", step: 3, message: "Ergebnisse sammeln..." });
    const jobItemsLocator = page.locator('a[id^="ergebnisliste-item-"]');
    await jobItemsLocator.first().waitFor({ timeout: 10000 }).catch(() => {});
    const jobElements = await jobItemsLocator.all();
    onEvent({ type: "step", step: 3, message: `Gefundene Treffer: ${jobElements.length}` });

    const jobLinks: { link: string; title: string }[] = [];
    for (let i = 0; i < jobElements.length; i++) {
      const jobElement = jobElements[i];
      const jobLink = await jobElement.getAttribute("href").catch(() => null);
      let jobTitle = await jobElement.locator("h3").innerText().catch(() => "Titel nicht verfügbar");
      jobTitle = jobTitle.replace(/^\d+\.\s*Ergebnis\s*/, "").replace(/^:\s*/, "").trim();
      if (jobLink) {
        jobLinks.push({ link: new URL(jobLink, targetUrl).toString(), title: jobTitle });
      }
    }

    let inserted = 0;
    let skipped = 0;

    onEvent({ type: "step", step: 4, message: `Details extrahieren (${jobLinks.length})...` });

    for (let i = 0; i < jobLinks.length; i++) {
      const { link: absoluteLink, title: jobTitle } = jobLinks[i];
      onEvent({ type: "step", step: 4, message: `Job ${i + 1}/${jobLinks.length} wird verarbeitet...` });

      try {
        await page.goto(absoluteLink, { waitUntil: "domcontentloaded", timeout: 20000 });
      } catch {}

      await page.waitForTimeout(1200);

      let jobDescription = "";
      let firma = "";
      let arbeitsort = "";

      try {
        const descElement = page.locator('xpath=//*[@id="detail-beschreibung-beschreibung"]');
        await descElement.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(300);
        const isVisible = await descElement.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) {
          jobDescription = await descElement.innerText({ timeout: 2000 }).catch(() => "");
        }
      } catch {}

      if (!jobDescription || jobDescription.length < 50) {
        try {
          const descElement = page.locator("div[class*='beschreibung']").first();
          jobDescription = await descElement.innerText({ timeout: 1500 }).catch(() => "");
        } catch {}
      }

      try {
        const firmaElement = page.locator('xpath=//*[@id="detail-kopfbereich-firma"]');
        await firmaElement.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(200);
        const isVisible = await firmaElement.isVisible({ timeout: 1500 }).catch(() => false);
        if (isVisible) {
          firma = await firmaElement.innerText({ timeout: 1500 }).catch(() => "");
          firma = firma.replace(/^Arbeitgeber:\s*/, "").replace(/^:\s*/, "").trim();
        }
      } catch {}

      try {
        const arbeitsortElement = page.locator('xpath=//*[@id="detail-kopfbereich-arbeitsort"]');
        await arbeitsortElement.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(200);
        const isVisible = await arbeitsortElement.isVisible({ timeout: 1500 }).catch(() => false);
        if (isVisible) {
          arbeitsort = await arbeitsortElement.innerText({ timeout: 1500 }).catch(() => "");
          arbeitsort = arbeitsort.replace(/^:\s*/, "").trim();
        }
      } catch {}

      const jobData: JobData = {
        title: jobTitle,
        description: jobDescription.trim(),
        link: absoluteLink,
        firma: (firma || "").trim(),
        arbeitsort: (arbeitsort || "").trim(),
      };

      jobs.push(jobData);

      // Insert into Postgres (dedup by link)
      const insert = await pool.query(
        `insert into jobs (title, description, link, firma, arbeitsort)
         values ($1, $2, $3, $4, $5)
         on conflict (link) do nothing
         returning id`,
        [jobData.title, jobData.description, jobData.link, jobData.firma ?? null, jobData.arbeitsort ?? null]
      );

      const isNew = insert.rowCount > 0;
      if (isNew) inserted++; else skipped++;

      onEvent({ type: "data", data: jobData, meta: { new: isNew } });

      if (limitNew && inserted >= limitNew) {
        onEvent({ type: "step", step: 5, message: `Limit erreicht (${limitNew} neue Einträge).` });
        break;
      }
    }

    onEvent({ type: "step", step: 5, message: "Fertig." });

    await context.close();

    return { processed: jobs.length, inserted, skipped, jobs };
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    try { await pool.end(); } catch {}
  }
}

export default async function handler(req: any, res: any) {
  const limitNew = parseLimit(req);

  if (isSSE(req)) {
    // Stream progress + results
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const onEvent = (evt: any) => sseWrite(res, evt);

    try {
      sseWrite(res, { type: "step", step: 0, message: "Starte Scraper..." });
      const { processed, inserted, skipped, jobs } = await scrapeAndPersist({ limitNew, onEvent });

      sseWrite(res, { type: "complete", message: `Verarbeitet: ${processed}, neu: ${inserted}, übersprungen: ${skipped}`, processed, inserted, skipped });
    } catch (error: any) {
      sseWrite(res, { type: "error", error: error?.message || String(error) });
    } finally {
      res.end();
    }
    return;
  }

  // Fallback: non-streaming (e.g. cron POST)
  try {
    const { processed, inserted, skipped } = await scrapeAndPersist({
      limitNew,
      onEvent: () => {},
    });

    res.status(200).json({ success: true, processed, inserted, skipped });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || String(error) });
  }
}
