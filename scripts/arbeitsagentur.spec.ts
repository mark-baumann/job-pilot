import { test, Page } from "@playwright/test";
import path from "path";

const sendUpdate = (data: object) => {
  console.log(JSON.stringify(data));
};

const takeScreenshot = async (page: Page, name: string) => {
  const screenshotPath = path.resolve(__dirname, `../test-results/${name}.png`);
  await page.screenshot({ path: screenshotPath });
  sendUpdate({ status: `Screenshot taken: ${name}.png`, screenshotPath });
};

const getJobDetails = async (page: Page, jobLink: string) => {
  await page.goto(jobLink);
  await takeScreenshot(page, "job-details");

  const jobTitle = await page.locator("h1").innerText();
  const company = await page.locator("a.jobs-company-link").innerText();
  const description = await page.locator("div.jobs-description-content").innerText();

  return {
    title: jobTitle,
    company,
    description,
  };
};

test("visit Arbeitsagentur job search and extract jobs", async ({ page }) => {
  sendUpdate({ status: "Navigating to Arbeitsagentur job search..." });
  await page.goto(
    "https://www.arbeitsagentur.de/jobsuche/suche?berufsfeld=Softwareentwicklung%20und%20Programmierung&angebotsart=1&wo=85256%20Vierkirchen,%20Oberbayern&umkreis=25"
  );

  await takeScreenshot(page, "initial-page");

  sendUpdate({ status: "Handling cookie banner..." });
  try {
    const acceptButton = page.getByTestId("bahf-cookie-disclaimer-btn-alle");
    await acceptButton.waitFor({ state: "visible", timeout: 10000 });
    await acceptButton.click();
    await page
      .locator("#bahf-cookie-disclaimer-modal")
      .waitFor({ state: "hidden", timeout: 5000 });
    sendUpdate({ status: "Cookie banner accepted." });
    await takeScreenshot(page, "after-cookie-banner");
  } catch (error) {
    sendUpdate({ status: "Cookie banner not found or could not be handled." });
  }

  sendUpdate({ status: "Waiting for job results..." });
  const jobItemsLocator = page.locator('a[id^="ergebnisliste-item-"]');
  await jobItemsLocator.first().waitFor();
  sendUpdate({ status: "Job results loaded." });
  await takeScreenshot(page, "job-results");

  const jobElements = await jobItemsLocator.all();
  const jobs = [];
  for (const jobElement of jobElements) {
    const link = await jobElement.getAttribute("href");
    const title = await jobElement.locator("h3").innerText();

    if (title && link) {
      const absoluteLink = new URL(link, page.url()).toString();
      jobs.push({ title, link: absoluteLink });
    }
  }

  if (jobs.length > 0) {
    sendUpdate({ status: `Found ${jobs.length} jobs. Fetching details for the first one...` });
    const jobDetails = await getJobDetails(page, jobs[0].link);
    sendUpdate({ status: "Job details fetched.", job: jobDetails });
  } else {
    sendUpdate({ status: "No jobs found." });
  }
});
