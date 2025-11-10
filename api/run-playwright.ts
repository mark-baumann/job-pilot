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

    await page.goto(
      "https://www.arbeitsagentur.de/jobsuche/suche?berufsfeld=Softwareentwicklung%20und%20Programmierung&angebotsart=1&wo=85256%20Vierkirchen,%20Oberbayern&umkreis=25"
    );

    // Handle cookie consent
    try {
        const acceptButton = page.getByTestId("bahf-cookie-disclaimer-btn-alle");
        await acceptButton.waitFor({ state: 'visible', timeout: 10000 });
        await acceptButton.click();
        // Wait for the modal to disappear
        await page.locator('#bahf-cookie-disclaimer-modal').waitFor({ state: 'hidden', timeout: 5000 });
        console.log("Cookie consent handled.");
    } catch (e) {
        console.log("Cookie consent button not found or already handled.");
    }
    
    await page.waitForTimeout(500); // wait for page to settle

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
