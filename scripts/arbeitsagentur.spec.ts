import { test, expect } from '@playwright/test';

test('visit Arbeitsagentur job search', async ({ page }) => {
  await page.goto('https://www.arbeitsagentur.de/jobsuche/suche?berufsfeld=Softwareentwicklung%20und%20Programmierung&angebotsart=1&wo=85256%20Vierkirchen,%20Oberbayern&umkreis=25');
  
  // Handle cookie consent
  await page.getByTestId('bahf-cookie-disclaimer-btn-alle').click();

  // Wait for the page to load and take a screenshot
  await page.screenshot({ path: 'scripts/arbeitsagentur.png' });

  // Optional: Add an assertion to check for a specific element
  // For example, check if the search results are visible
  await expect(page.getByRole('heading', { name: 'Jobsuche', exact: true })).toBeVisible();
});
