import { VercelRequest, VercelResponse } from "@vercel/node";
import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

interface ScraperEvent {
  type: "step" | "data" | "error" | "complete" | "screenshot";
  step?: number;
  message?: string;
  data?: any;
  error?: string;
  image?: string;
}

interface JobData {
  title: string;
  description: string;
  link: string;
  firma?: string;
  arbeitsort?: string;
}

// Simple in-memory cache
let cachedJobs: JobData[] = [];
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function scrapeArbeitsagenturJob(
  onProgress: (event: ScraperEvent) => void
) {
  let browser = null;
  try {
    // Check cache
    const now = Date.now();
    if (cachedJobs.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
      onProgress({
        type: "step",
        step: 1,
        message: `Cache gefunden! ${cachedJobs.length} Jobs geladen.`,
      });

      // Send all cached jobs
      for (const job of cachedJobs) {
        onProgress({
          type: "data",
          data: job,
        });
      }

      onProgress({
        type: "complete",
        message: "Jobs aus Cache geladen!",
      });
      return;
    }

    const executablePath = await chromium.executablePath();
    if (typeof executablePath !== "string") {
      throw new Error(
        `Invalid executablePath, expected string but got ${typeof executablePath}`
      );
    }
    browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath: executablePath,
      headless: chromium.headless,
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // Schritt 1: Webseite aufrufen
    onProgress({
      type: "step",
      step: 1,
      message: "Webseite wird aufgerufen...",
    });

    const targetUrl =
      "https://www.arbeitsagentur.de/jobsuche/suche?berufsfeld=Softwareentwicklung%20und%20Programmierung&angebotsart=1&wo=85256%20Vierkirchen,%20Oberbayern&umkreis=25";

    try {
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
    } catch (e) {
      console.warn("Timeout beim Laden der Seite, versuche weiterzumachen...");
    }

    // Screenshot der Suchergebnisse
    let screenshot1 = await page.screenshot({ path: undefined }).catch(() => null);
    if (screenshot1) {
      const base64 = Buffer.from(screenshot1).toString('base64');
      onProgress({
        type: "screenshot",
        image: `data:image/png;base64,${base64}`,
      });
    }

    // Schritt 2: Cookie-Dialog wegklicken
    onProgress({
      type: "step",
      step: 2,
      message: "Cookie-Dialog wird wegeklickt...",
    });

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

    // Screenshot nach Cookie-Dialog
    let screenshot2 = await page.screenshot({ path: undefined }).catch(() => null);
    if (screenshot2) {
      const base64 = Buffer.from(screenshot2).toString('base64');
      onProgress({
        type: "screenshot",
        image: `data:image/png;base64,${base64}`,
      });
    }

    // Schritt 3: Jobs laden
    onProgress({
      type: "step",
      step: 3,
      message: "Jobs werden geladen...",
    });

    try {
      const jobItemsLocator = page.locator('a[id^="ergebnisliste-item-"]');
      await jobItemsLocator
        .first()
        .waitFor({ timeout: 10000 })
        .catch(() => {});
      const jobElements = await jobItemsLocator.all();

      onProgress({
        type: "step",
        step: 3,
        message: `${jobElements.length} Jobs gefunden!`,
      });

      // Screenshot der Jobliste
      let screenshot3 = await page.screenshot({ path: undefined }).catch(() => null);
      if (screenshot3) {
        const base64 = Buffer.from(screenshot3).toString('base64');
        onProgress({
          type: "screenshot",
          image: `data:image/png;base64,${base64}`,
        });
      }

      // Schritt 4: Alle Jobs durchgehen und Daten extrahieren
      const totalJobs = jobElements.length;
      cachedJobs = []; // Reset cache

      // Sammle zuerst alle Job-Links und Titel, bevor wir die Seite verlassen
      const jobLinks: { link: string; title: string }[] = [];
      for (let i = 0; i < totalJobs; i++) {
        const jobElement = jobElements[i];
        const jobLink = await jobElement
          .getAttribute("href")
          .catch(() => null);
        let jobTitle = await jobElement
          .locator("h3")
          .innerText()
          .catch(() => "Titel nicht verfügbar");

        // Entferne "1. Ergebnis", "2. Ergebnis" etc. und Doppelpunkte
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

      // Jetzt gehe durch alle gesammelten Links und extrahiere Daten
      for (let i = 0; i < jobLinks.length; i++) {
        const { link: absoluteLink, title: jobTitle } = jobLinks[i];

        onProgress({
          type: "step",
          step: 4,
          message: `Job ${i + 1}/${totalJobs} wird geöffnet...`,
        });

        try {
          await page.goto(absoluteLink, {
            waitUntil: "domcontentloaded",
            timeout: 20000,
          });
        } catch (e) {
          console.warn("Timeout beim Laden der Job-Seite");
        }

        // Warte länger, damit Seite vollständig geladen ist
        await page.waitForTimeout(1500);

        let jobDescription = "";
        let firma = "";
        let arbeitsort = "";

        // Extrahiere Beschreibung - scrolle zum Element für besseres Laden
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
          console.log("Beschreibung nicht mit XPath gefunden, versuche Fallback");
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
            // Entferne "Arbeitgeber:" Präfix
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
            // Entferne führende Doppelpunkte
            arbeitsort = arbeitsort.replace(/^:\s*/, "").trim();
          }
        } catch (e) {
          console.log("Arbeitsort nicht mit XPath gefunden");
        }

        // Sende die Jobdaten
        const jobData: JobData = {
          title: jobTitle,
          description: jobDescription.trim(),
          link: absoluteLink,
          firma: firma.trim(),
          arbeitsort: arbeitsort.trim(),
        };

        cachedJobs.push(jobData);

        onProgress({
          type: "data",
          data: jobData,
        });

        // Screenshot der Job-Detail-Seite
        let jobScreenshot = await page.screenshot({ path: undefined }).catch(() => null);
        if (jobScreenshot) {
          const base64 = Buffer.from(jobScreenshot).toString('base64');
          onProgress({
            type: "screenshot",
            image: `data:image/png;base64,${base64}`,
          });
        }

        onProgress({
          type: "step",
          step: 4,
          message: `✅ Job ${i + 1}/${totalJobs} extrahiert`,
        });
      }

      // Update cache timestamp
      cacheTimestamp = Date.now();
    } catch (e) {
      console.error("Fehler beim Scrapen der Jobs:", e);
    }

    // Abschluss
    onProgress({
      type: "complete",
      message: `Scraping abgeschlossen! ${cachedJobs.length} Jobs gefunden.`,
    });

    return {
      success: true,
      message: "Scraping erfolgreich abgeschlossen",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Scraping error:", errorMessage);
    onProgress({
      type: "error",
      error: errorMessage,
    });
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
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "GET") {
    res.status(405).end("Method Not Allowed");
    return;
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    await scrapeArbeitsagenturJob((event: ScraperEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    res.end();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        error: errorMessage,
      })}\n\n`
    );
    res.end();
  }
}
