import { expect, test } from '@playwright/test';
import { hostParty, joinParty } from './helpers';

// One party and one table, played through the real UI over the realtime
// Worker. Desktop only: the phone project runs the homepage suite.

test('two players play a hand of Teen Patti, and nobody sees cards they shouldn’t', async ({
  page,
  browser,
}) => {
  const { code, partyUrl } = await hostParty(page, 'Card night', 'Asha');
  const ticket = await page.request.post(
    `${partyUrl.replace(/^.*\/party\//, '/api/parties/')}/ticket`,
  );
  test.skip(ticket.status() === 503, 'Realtime keys are not configured on this machine.');
  expect(ticket.status()).toBe(200);

  const guest = await joinParty(browser, code, 'Meera');

  await page.getByRole('link', { name: /The Card Room/ }).click();
  await page.getByRole('button', { name: 'Open a table' }).click();
  await page.waitForURL(/\/games\/[a-z0-9]+$/);
  const tableUrl = new URL(page.url()).pathname;

  await page.getByRole('button', { name: /Take a seat/ }).click();
  await guest.page.goto(tableUrl);
  await guest.page.getByRole('button', { name: /Take a seat/ }).click();
  await expect(page.getByText('Meera sat down.')).toBeVisible();

  await page.getByRole('button', { name: 'Deal' }).click();
  // Everyone starts blind: every card on both screens is face down.
  await expect(guest.page.getByText(/Your turn/)).toBeVisible();
  for (const p of [page, guest.page]) {
    await expect(p.getByRole('img', { name: 'Face-down card' })).toHaveCount(6);
  }

  await guest.page.getByRole('button', { name: 'See cards' }).click();
  await expect(
    guest.page.getByRole('img', { name: / of (hearts|diamonds|spades|clubs)$/ }),
  ).toHaveCount(3);
  const guestCards = await guest.page
    .getByRole('img', { name: / of / })
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  // The host still sees only backs: nothing about Meera's hand has reached them.
  await expect(page.getByRole('img', { name: 'Face-down card' })).toHaveCount(6);
  for (const name of guestCards)
    await expect(page.getByRole('img', { name: name! })).toHaveCount(0);

  await guest.page.getByRole('button', { name: /^Chaal/ }).click();
  await expect(page.getByText('Meera played chaal: 20.')).toBeVisible();
  await page.getByRole('button', { name: 'See cards' }).click();
  await page.getByRole('button', { name: /^Show/ }).click();

  // The show reveals both hands to both players, and someone is paid.
  for (const p of [page, guest.page]) {
    await expect(p.getByText(/won \d+/).first()).toBeVisible();
    await expect(p.getByRole('img', { name: 'Face-down card' })).toHaveCount(0);
  }
  await expect(page.getByRole('button', { name: 'Deal the next hand' })).toBeVisible();
  await guest.context.close();
});
