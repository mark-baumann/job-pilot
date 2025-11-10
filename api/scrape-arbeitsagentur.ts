import { VercelRequest, VercelResponse } from "@vercel/node";
import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

interface ScraperEvent {
  type: "step" | "data" | "error" | "complete";
  step?: number;
  message?: string;
  data?: any;
  error?: string;
}

async function scrapeArbeitsagenturJob(
  onProgress: (event: ScraperEvent) => void
) {
  let browser = null;
  try {
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

    // Schritt 3: Jobs laden und anzeigen
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

      // Schritt 4: Einen Job öffnen und Daten extrahieren
      if (jobElements.length > 0) {
        onProgress({
          type: "step",
          step: 4,
          message: "Erster Job wird geöffnet...",
        });

        const firstJobLink = await jobElements[0]
          .getAttribute("href")
          .catch(() => null);
        const firstJobTitle = await jobElements[0]
          .locator("h3")
          .innerText()
          .catch(() => "Titel nicht verfügbar");

        if (firstJobLink) {
          const absoluteLink = new URL(firstJobLink, targetUrl).toString();

          try {
            await page.goto(absoluteLink, {
              waitUntil: "networkidle",
              timeout: 20000,
            });
          } catch (e) {
            console.warn("Timeout beim Laden der Job-Seite");
          }

          // Schritt 5: Jobdaten extrahieren
          onProgress({
            type: "step",
            step: 5,
            message: "Jobdetails werden extrahiert...",
          });

          // Warte kurz, damit Seite vollständig geladen ist
          await page.waitForTimeout(2000);

          let jobDescription = "";

          // Versuche verschiedene Selektoren für Jobdescription
          const descriptionSelectors = [
            'div[class*="stellenangebot"]',
            'div[class*="job-description"]',
            'div[class*="Inhalt"]',
            'section[class*="content"]',
            "main",
            "article",
          ];

          for (const selector of descriptionSelectors) {
            try {
              const element = page.locator(selector).first();
              const isVisible = await element
                .isVisible({ timeout: 2000 })
                .catch(() => false);

              if (isVisible) {
                const text = await element
                  .innerText({ timeout: 3000 })
                  .catch(() => "");
                if (text && text.length > 100) {
                  jobDescription = text.substring(0, 500); // Limit auf 500 Zeichen
                  break;
                }
              }
            } catch (e) {
              // Selector nicht gefunden, nächster versuchen
            }
          }

          // Fallback: Hole den gesamten Body-Text
          if (!jobDescription || jobDescription.length < 50) {
            try {
              jobDescription = await page
                .innerText("body")
                .then((text) => text.substring(0, 500))
                .catch(() => "Beschreibung nicht verfügbar");
            } catch (e) {
              jobDescription = "Beschreibung nicht verfügbar";
            }
          }

          // Sende die Jobdaten
          onProgress({
            type: "data",
            data: {
              title: firstJobTitle,
              description: jobDescription.trim(),
              link: absoluteLink,
            },
          });

          onProgress({
            type: "step",
            step: 5,
            message: `✅ Job extrahiert: "${firstJobTitle}"`,
          });
        }
      }
    } catch (e) {
      console.error("Fehler beim Scrapen der Jobs:", e);
    }

    // Abschluss
    onProgress({
      type: "complete",
      message: "Scraping abgeschlossen!",
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
