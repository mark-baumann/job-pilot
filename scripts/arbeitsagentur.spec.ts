import { test, expect } from '@playwright/test';

test('visit Arbeitsagentur job search', async ({ page }) => {
  await page.goto('https://www.arbeitsagentur.de/jobsuche/suche?berufsfeld=Softwareentwicklung%20und%20Programmierung&angebotsart=1&wo=85256%20Vierkirchen,%20Oberbayern&umkreis=25');

  // Wait for and accept the cookie banner
  try {
    const acceptButton = page.getByTestId("bahf-cookie-disclaimer-btn-alle");
    await acceptButton.waitFor({ state: 'visible', timeout: 10000 });
    await acceptButton.click();
    // Wait for the modal to disappear
    await page.locator('#bahf-cookie-disclaimer-modal').waitFor({ state: 'hidden', timeout: 5000 });
  } catch (error) {
    console.log('Cookie banner not found or could not be handled.', error);
  }

  // Now take the screenshot
  await page.screenshot({ path: 'scripts/arbeitsagentur.png' });

  // Optional: Check for the job search results
  await expect(page.getByRole('heading', { name: 'Jobsuche', exact: true })).toBeVisible();
});
