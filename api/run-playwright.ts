import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

export default async function handler(
  req: any,
  res: any
) {
  let browser = null;
  try {
    const executablePath = await chromium.executablePath();
    if (typeof executablePath !== 'string') {
        throw new Error(`Invalid executablePath, expected string but got ${typeof executablePath}`);
    }
    browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath: executablePath,
      headless: chromium.headless,
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    const targetUrl = "https://www.arbeitsagentur.de/jobsuche/suche?berufsfeld=Softwareentwicklung%20und%20Programmierung&angebotsart=1&wo=85256%20Vierkirchen,%20Oberbayern&umkreis=25";
    await page.goto(targetUrl);

    // Handle cookie consent
    try {
        const acceptButton = page.getByTestId("bahf-cookie-disclaimer-btn-alle");
        await acceptButton.waitFor({ state: 'visible', timeout: 10000 });
        await acceptButton.click();
        await page.locator('#bahf-cookie-disclaimer-modal').waitFor({ state: 'hidden', timeout: 5000 });
    } catch (e) {
        console.log("Cookie consent button not found or already handled.");
    }
    
    // Wait for the results to be loaded
    const jobItemsLocator = page.locator('a[id^="ergebnisliste-item-"]');
    await jobItemsLocator.first().waitFor();

    const jobElements = await jobItemsLocator.all();

    const jobs = [];
    for (const jobElement of jobElements) {
      const link = await jobElement.getAttribute('href');
      const title = await jobElement.locator('h3').innerText();
  
      if (title && link) {
        const absoluteLink = new URL(link, targetUrl).toString();
        jobs.push({ title, link: absoluteLink });
      }
    }

    res.status(200).json({
      message: `Successfully scraped ${jobs.length} jobs.`,
      jobs: jobs,
    });
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: `An error occurred: ${errorMessage}` });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
