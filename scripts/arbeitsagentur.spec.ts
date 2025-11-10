import { test } from '@playwright/test';

test('visit Arbeitsagentur job search and extract jobs', async ({ page }) => {
  await page.goto('https://www.arbeitsagentur.de/jobsuche/suche?berufsfeld=Softwareentwicklung%20und%20Programmierung&angebotsart=1&wo=85256%20Vierkirchen,%20Oberbayern&umkreis=25');

  // Wait for and accept the cookie banner
  try {
    const acceptButton = page.getByTestId("bahf-cookie-disclaimer-btn-alle");
    await acceptButton.waitFor({ state: 'visible', timeout: 10000 });
    await acceptButton.click();
    await page.locator('#bahf-cookie-disclaimer-modal').waitFor({ state: 'hidden', timeout: 5000 });
  } catch (error) {
    // Suppress verbose error logging in the test output for this part
    console.log('Cookie banner not found or could not be handled.');
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
      // The link is relative, so we need to make it absolute
      const absoluteLink = new URL(link, page.url()).toString();
      jobs.push({ title, link: absoluteLink });
    }
  }

  console.log(JSON.stringify(jobs));
});
