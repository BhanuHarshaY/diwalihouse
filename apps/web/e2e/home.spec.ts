import { expect, test } from '@playwright/test';

test.describe('homepage', () => {
  test('opens on one lamp and lets the visitor pass the flame', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('section[aria-labelledby="scene-diya-title"][data-mode="camera"]'),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'On the darkest night, someone lights a lamp.' }),
    ).toBeVisible();

    const share = page.getByRole('button', { name: 'Pass the flame' });
    await expect(share).toBeVisible({ timeout: 6_000 });
    await share.click();
    await expect(page.getByText(/^Three of (seven|nine) lamps lit\.$/)).toBeAttached();
    await expect(page.locator('[data-offset][data-lit]')).toHaveCount(3);
  });

  test('scrolling lights the whole row', async ({ page, viewport }) => {
    await page.goto('/');
    const scene = page.locator('main > section').first();
    await scene.evaluate((el: HTMLElement) => window.scrollTo(0, el.offsetHeight * 0.45));
    const expected = (viewport?.width ?? 1280) < 640 ? 7 : 9;
    await expect(page.locator('[data-offset][data-lit]:not([data-off-stage])')).toHaveCount(
      expected,
    );
    await expect(page.getByRole('heading', { name: 'Deepavali' })).toBeAttached();
  });

  test('the skip link goes straight to the party controls', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Skip to the party/ }).click();
    await expect(page).toHaveURL(/#enter$/);
    await expect(page.getByRole('link', { name: 'Host a party' })).toBeInViewport();
  });

  test('presents several traditions, not one account', async ({ page }) => {
    await page.goto('/');
    const entries = page.locator(
      '#stories-title ~ * li, section[aria-labelledby="stories-title"] ol > li',
    );
    await expect(entries).toHaveCount(8);
    for (const who of ['For Jains', 'For Sikhs', 'In much of South India']) {
      await expect(page.getByText(who, { exact: true })).toBeAttached();
    }
  });

  test('every tradition has its window, and the rangoli assembles on scroll', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('li[data-tradition] svg')).toHaveCount(8);

    const rangoli = page.locator('section[aria-labelledby="rangoli-title"]');
    await expect(rangoli).toHaveAttribute('data-mode', 'camera');
    await rangoli.evaluate((el: HTMLElement) =>
      window.scrollTo(0, el.offsetTop + (el.offsetHeight - window.innerHeight) * 0.95),
    );
    await expect(rangoli).toHaveAttribute('data-assembled', '');
    // Every ring has arrived at full opacity.
    await expect
      .poll(() =>
        rangoli.evaluate((el) =>
          [...el.querySelectorAll<HTMLElement>('[data-ring]')].every(
            (ring) => getComputedStyle(ring).opacity === '1',
          ),
        ),
      )
      .toBe(true);
  });

  test('brings family and friends, each group described for screen readers', async ({ page }) => {
    await page.goto('/');
    const people = page.locator('section[aria-labelledby="people-title"]');
    await expect(people.getByRole('img', { name: /A family gathered for Diwali/ })).toBeAttached();
    await expect(people.getByRole('img', { name: /Friends arriving for Diwali/ })).toBeAttached();
  });

  test('never scrolls sideways, at any point in the story', async ({ page }) => {
    await page.goto('/');
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 600) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(60);
      const [scrollWidth, innerWidth] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        window.innerWidth,
      ]);
      expect(scrollWidth, `horizontal overflow at y=${y}`).toBeLessThanOrEqual(innerWidth);
    }
  });

  test('checks invitation codes before navigating', async ({ page }) => {
    await page.goto('/#enter');
    const field = page.getByLabel('Invitation code');
    await field.fill('nope');
    await page.getByRole('button', { name: 'Find my invitation' }).click();
    await expect(page.getByText('Codes look like ABCD-1234.')).toBeVisible();

    await field.fill('abcd-efgh');
    await page.getByRole('button', { name: 'Find my invitation' }).click();
    await expect(page).toHaveURL(/\/join\/ABCDEFGH$/);
    await expect(page.getByRole('heading', { name: 'This invitation has expired' })).toBeVisible();
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('renders a still, fully readable scene with every lamp lit', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.locator('section[aria-labelledby="scene-diya-title"][data-mode="static"]'),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Deepavali' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /darkest night/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pass the flame' })).toBeHidden();
    // The rangoli is complete and still, with no pinned scroll.
    const rangoli = page.locator('section[aria-labelledby="rangoli-title"]');
    await expect(rangoli).toHaveAttribute('data-mode', 'static');
    await expect(rangoli.locator('[data-ring]').first()).toHaveCSS('opacity', '1');
  });
});
