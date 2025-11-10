import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

export default async function handler(
  req: any,
  res: any
) {
  let browser = null;
  try {
    browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(
      "https://www.arbeitsagentur.de/jobsuche/suche?berufsfeld=Softwareentwicklung%20und%20Programmierung&angebotsart=1&wo=85256%20Vierkirchen,%20Oberbayern&umkreis=25"
    );

    // Handle cookie consent
    try {
        await page.getByTestId("bahf-cookie-disclaimer-btn-alle").click({ timeout: 3000 });
    } catch (e) {
        console.log("Cookie consent button not found or already handled.");
    }

    // Wait for navigation and get the heading
    const heading = page.getByRole("heading", { name: "Jobsuche", exact: true });
    await heading.waitFor({ state: "visible" });

    const screenshotBuffer = await page.screenshot();
    const screenshotBase64 = screenshotBuffer.toString('base64');

    res.status(200).json({
      message: "Playwright script executed successfully.",
      screenshot: `data:image/png;base64,${screenshotBase64}`,
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
