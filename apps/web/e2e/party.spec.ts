import { expect, test } from '@playwright/test';
import { hostParty, joinParty } from './helpers';

// Each test creates its own parties; party creation is rate limited to 10
// per client per hour, so keep the total across this file under that.
test.describe.configure({ mode: 'serial' });

test(
  'a host opens a party and a guest joins it from another browser',
  { tag: '@phone' },
  async ({ page, browser }) => {
    const { code } = await hostParty(page, 'The Rao family Diwali', 'Asha');
    // Alone in the house, the host sees friends on their way.
    await expect(page.getByText("You're the first one here")).toBeVisible();
    await expect(page.getByRole('img', { name: 'QR code for the invitation link' })).toBeVisible();

    const guest = await joinParty(browser, code, 'हर्ष');
    await expect(
      guest.page.getByRole('heading', { level: 1, name: 'The Rao family Diwali' }),
    ).toBeVisible();
    await expect(guest.page.getByText('हर्ष (you)')).toBeVisible();
    // Only the host holds the invitation.
    await expect(guest.page.getByTestId('invite-code')).toHaveCount(0);
    await expect(guest.page.getByText('Invitations come from Asha.')).toBeVisible();
    const partyId = guest.page.url().split('/').pop();
    const seenByGuest = await (await guest.page.request.get(`/api/parties/${partyId}`)).json();
    expect(seenByGuest.invite).toBeNull();

    // The host's list refreshes by polling.
    await expect(page.getByText('हर्ष', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("You're the first one here")).toHaveCount(0);

    // Session recovery: the invitation link sends a returning guest straight back in.
    await guest.page.goto(`/join/${code}`);
    await expect(guest.page).toHaveURL(/\/party\//);
    await expect(guest.page.getByText('हर्ष (you)')).toBeVisible();
    await guest.context.close();
  },
);

test('a guest from one party cannot see or read another', async ({ page, browser }) => {
  const a = await hostParty(page, 'Party A', 'Asha');
  const hostB = await browser.newContext();
  const b = await hostParty(await hostB.newPage(), 'Party B', 'Bilal');

  const guestOfA = await joinParty(browser, a.code, 'Chitra');

  await guestOfA.page.goto(`/party/${b.partyId}`);
  await expect(guestOfA.page.getByRole('heading', { name: 'This door is closed' })).toBeVisible();
  await expect(guestOfA.page.getByText('Party B')).toHaveCount(0);

  const api = await guestOfA.page.request.get(`/api/parties/${b.partyId}`);
  expect(api.status()).toBe(401);
  expect(JSON.stringify(await api.json())).not.toContain('Party B');

  const own = await guestOfA.page.request.get(`/api/parties/${a.partyId}`);
  expect(own.status()).toBe(200);

  // Unknown and malformed ids answer exactly like a real party you are not in.
  for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
    const probe = await guestOfA.page.request.get(`/api/parties/${id}`);
    expect(probe.status()).toBe(401);
  }

  await guestOfA.context.close();
  await hostB.close();
});

test('the host can replace the invitation and remove a guest', async ({ page, browser }) => {
  const { code } = await hostParty(page, 'Mehta Mehfil', 'Kabir');
  const guest = await joinParty(browser, code, 'Dev');
  await expect(page.getByText('Dev', { exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Make a new code' }).click();
  await page.getByRole('button', { name: 'Make new code' }).click();
  await expect(page.getByText(/New invitation code/)).toBeVisible();
  const newCode = (await page.getByTestId('invite-code').textContent())?.replace('-', '').trim();
  expect(newCode).not.toBe(code);

  const late = await browser.newContext();
  const latePage = await late.newPage();
  await latePage.goto(`/join/${code}`);
  await expect(
    latePage.getByRole('heading', { name: 'This invitation has expired' }),
  ).toBeVisible();
  await late.close();

  await page
    .getByRole('listitem')
    .filter({ hasText: 'Dev' })
    .getByRole('button', { name: 'Remove' })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel(/Also make a new invitation code/)
    .check();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Dev', { exact: true })).toHaveCount(0);
  // Removing with "also make a new code" replaced the invitation again.
  await expect(page.getByTestId('invite-code')).not.toHaveText(
    `${newCode!.slice(0, 4)}-${newCode!.slice(4)}`,
  );

  await expect(
    guest.page.getByRole('heading', { name: 'You are no longer in this party' }),
  ).toBeVisible({
    timeout: 12_000,
  });
  await guest.context.close();
});

test('names must be unique within a party', async ({ page, browser }) => {
  const { code } = await hostParty(page, 'Name Clash', 'Asha');
  const context = await browser.newContext();
  const guest = await context.newPage();
  await guest.goto(`/join/${code}`);
  await guest.getByLabel('Your name').fill('asha');
  await guest.locator('label', { hasText: 'Moon' }).click();
  await guest.getByRole('button', { name: 'Enter the party' }).click();
  await expect(
    guest.getByText('Someone in the party already goes by that name.').first(),
  ).toBeVisible();
  // The form keeps what was typed.
  await expect(guest.getByLabel('Your name')).toHaveValue('asha');
  await context.close();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('hosting still works end to end', async ({ page }) => {
    await page.goto('/host');
    await page.getByLabel('Party name').fill('Plain HTML Diwali');
    await page.getByLabel('Your name').fill('Ira');
    await page.locator('label', { hasText: 'Marigold' }).click();
    await page.getByRole('button', { name: 'Open the house' }).click();
    await expect(page).toHaveURL(/\/party\//);
    await expect(page.getByRole('heading', { level: 1, name: 'Plain HTML Diwali' })).toBeVisible();
  });
});
