import { expect, type Browser, type Page } from '@playwright/test';

export async function hostParty(page: Page, partyName: string, hostName: string) {
  await page.goto('/host');
  await page.getByLabel('Party name').fill(partyName);
  await page.getByLabel('Your name').fill(hostName);
  await page.locator('label', { hasText: 'Lotus' }).click();
  await page.getByRole('button', { name: 'Open the house' }).click();
  await page.waitForURL(/\/party\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: partyName })).toBeVisible();
  const code = (await page.getByTestId('invite-code').textContent())?.replace('-', '').trim();
  if (!code) throw new Error('no invite code on the page');
  return { code, partyUrl: page.url(), partyId: page.url().split('/').pop()! };
}

export async function joinParty(browser: Browser, code: string, name: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/join/${code}`);
  await page.getByLabel('Your name').fill(name);
  await page.locator('label', { hasText: 'Kite' }).click();
  await page.getByRole('button', { name: 'Enter the party' }).click();
  await page.waitForURL(/\/party\//);
  return { context, page };
}
