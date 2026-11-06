// Visual QA: captures the key screens at phone and desktop sizes.
//
//   pnpm --filter @diwali/web exec node scripts/capture-screens.mjs [baseUrl] [only]
//
// Writes PNGs to test-results/screens/. Creates a real party through the UI,
// so it needs the dev server and database running.
import { mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'http://localhost:3000';
const only = process.argv[3];
const out = new URL('../test-results/screens/', import.meta.url).pathname;
await mkdir(out, { recursive: true });

const viewports = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};

const browser = await chromium.launch();

async function shoot(page, name) {
  await page.screenshot({ path: `${out}${name}.png` });
  console.log(`  ${name}.png`);
}

async function scrollToFraction(page, selector, fraction) {
  await page.evaluate(
    ([sel, f]) => {
      const el = document.querySelector(sel);
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + (el.offsetHeight - window.innerHeight) * f);
    },
    [selector, fraction],
  );
  await page.waitForTimeout(1400);
}

for (const [device, viewport] of Object.entries(viewports)) {
  if (only && only !== device) continue;
  console.log(device);
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log(`  page error: ${error.message}`));

  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await shoot(page, `${device}-01-dark`);
  await page.waitForTimeout(3600);
  await shoot(page, `${device}-02-lit`);
  await page.getByRole('button', { name: 'Pass the flame' }).click();
  await page.waitForTimeout(1800);
  await shoot(page, `${device}-03-shared`);
  await page.getByRole('button', { name: 'Pass the flame' }).click();
  await page.waitForTimeout(1800);
  await shoot(page, `${device}-04-shared-more`);

  const scene = 'main > section:first-of-type';
  await scrollToFraction(page, scene, 0.22);
  await shoot(page, `${device}-05-pullback`);
  await scrollToFraction(page, scene, 0.62);
  await shoot(page, `${device}-06-deepavali`);

  await page.locator('#stories-title').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -80));
  await page.waitForTimeout(1200);
  await shoot(page, `${device}-07-stories`);
  await page.locator('li', { hasText: 'Kali' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await shoot(page, `${device}-08-stories-mid`);

  await page.locator('#enter-title').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, viewport.height * 0.35));
  await page.waitForTimeout(2600);
  await shoot(page, `${device}-09-enter`);

  await page.goto(`${base}/host`, { waitUntil: 'networkidle' });
  await shoot(page, `${device}-10-host`);
  await page.getByLabel('Party name').fill('The Rao family Diwali');
  await page.getByLabel('Your name').fill('Asha');
  await page.getByText('Lotus').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}${device}-11-host-filled.png`, fullPage: true });
  await page.getByRole('button', { name: 'Open the house' }).click();
  await page.waitForURL(/\/party\//);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}${device}-12-party-host.png`, fullPage: true });

  const code = (await page.locator('[class*="code"]').last().textContent())?.trim();
  const guest = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const guestPage = await guest.newPage();
  await guestPage.goto(`${base}/join/${code?.replace('-', '')}`, { waitUntil: 'networkidle' });
  await shoot(guestPage, `${device}-13-join`);
  await guestPage.getByLabel('Your name').fill('हर्ष');
  await guestPage.getByText('Kite').click();
  await guestPage.getByRole('button', { name: 'Enter the party' }).click();
  await guestPage.waitForURL(/\/party\//);
  await guestPage.waitForTimeout(800);
  await guestPage.screenshot({ path: `${out}${device}-14-party-guest.png`, fullPage: true });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${out}${device}-15-party-host-sees-guest.png`, fullPage: true });
  await guest.close();
  await context.close();
}

await browser.close();
