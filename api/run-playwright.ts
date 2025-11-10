import playwright from "playwright-aws-lambda";
import chromium = require("chrome-aws-lambda");
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  let browser = null;
  try {
    browser = await playwright.launchChromium({
      headless: true,
      executablePath: await chromium.executablePath,
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(
      "https://www.arbeitsagentur.de/jobsuche/suche?berufsfeld=Softwareentwicklung%20und%20Programmierung&angebotsart=1&wo=85256%20Vierkirchen,%20Oberbayern&umkreis=25"
    );

    // Handle cookie consent
    await page.getByTestId("bahf-cookie-disclaimer-btn-alle").click();

    // Wait for navigation and get the heading
    const heading = page.getByRole("heading", { name: "Jobsuche", exact: true });
    await heading.waitFor({ state: "visible" });

    const screenshot = await page.screenshot({ encoding: "base64" });

    res.status(200).json({
      message: "Playwright script executed successfully.",
      screenshot: `data:image/png;base64,${screenshot}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: `An error occurred: ${error.message}` });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}