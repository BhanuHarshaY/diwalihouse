import { expect, test, type Browser, type Page } from '@playwright/test';
import { hostParty, joinParty } from './helpers';

// The Game Bazaar's three games, played through the UI over the realtime
// Worker by a host and three guests who share one party.
test.describe.configure({ mode: 'serial' });

let host: Page;
let guests: Page[] = [];
let partyPath = '';

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  host = await (await browser.newContext()).newPage();
  const { code, partyUrl } = await hostParty(host, 'Bazaar night', 'Asha');
  partyPath = new URL(partyUrl).pathname;
  const ticket = await host.request.post(`/api/parties/${partyPath.split('/').pop()}/ticket`);
  test.skip(ticket.status() === 503, 'Realtime keys are not configured on this machine.');
  guests = [];
  for (const name of ['Meera', 'Bilal', 'Chitra'])
    guests.push((await joinParty(browser, code, name)).page);
});

async function open(label: RegExp) {
  await host.goto(`${partyPath}/bazaar`);
  await host.getByRole('button', { name: label }).click();
  await host.waitForURL(/\/games\/[a-z0-9]+$/);
  return new URL(host.url()).pathname;
}

test('Tambola: tickets are private and claims are checked', async () => {
  const path = await open(/Start: 1 ticket each/);
  await host.getByRole('button', { name: 'Take a ticket' }).click();
  const meera = guests[0]!;
  await meera.goto(path);
  await meera.getByRole('button', { name: 'Take a ticket' }).click();
  await host.getByRole('button', { name: /Hand out tickets/ }).click();

  // A claim before any number is called is a bogey.
  await meera.getByRole('button', { name: 'Full house' }).click();
  await expect(meera.getByText(/Full house claim was a bogey/)).toBeVisible();

  const ticketNumbers = async (p: Page) =>
    (await p.getByRole('grid', { name: 'Ticket 1' }).getByRole('button').allTextContents()).filter(
      Boolean,
    );
  const mine = await ticketNumbers(meera);
  const hosts = await ticketNumbers(host);
  expect(mine).toHaveLength(15);
  expect(mine).not.toEqual(hosts);

  for (let i = 0; i < 90 && !(await host.getByText('Game over').count()); i++) {
    await host.getByRole('button', { name: 'Call the next number' }).click();
    if (i === 40) {
      await meera.getByRole('button', { name: 'Early five' }).click();
      await expect(meera.getByText('You won Early five! +10')).toBeVisible();
    }
  }
  await expect(host.getByText('90 of 90 called').or(host.getByText('Game over'))).toBeVisible();
  await expect(host.getByRole('region', { name: 'Prizes' }).getByText('Meera')).toBeVisible();
});

test('Raja Mantri Chor Sipahi: only the Mantri accuses, and the reveal scores everyone', async () => {
  const path = await open(/Start: 5 rounds/);
  await host.getByRole('button', { name: 'Take a seat' }).click();
  for (const g of guests) {
    await g.goto(path);
    await g.getByRole('button', { name: 'Take a seat' }).click();
  }
  await host.getByRole('button', { name: 'Shuffle the chits' }).click();

  const players = [host, ...guests];
  const mantris: Page[] = [];
  for (const p of players) {
    await expect(p.getByText('Round 1 of 5')).toBeVisible();
    // Everyone sees exactly two folded chits: the Chor and the Sipahi stay hidden.
    expect(await p.getByLabel('Hidden chit').count()).toBeLessThanOrEqual(2);
    if (await p.getByText('You’re the Mantri').count()) mantris.push(p);
  }
  expect(mantris).toHaveLength(1);
  await mantris[0]!
    .getByRole('button', { name: /is the Chor$/ })
    .first()
    .click();
  for (const p of players) {
    await expect(p.getByText(/The Chor (is caught|got away)!/)).toBeVisible();
    await expect(p.getByLabel('Hidden chit')).toHaveCount(0);
  }
  await expect(host.getByRole('button', { name: 'Next round' })).toBeVisible();
});

test('Dumb Charades: only the actor sees the film, and a typed guess scores', async () => {
  const path = await open(/Start: 3 turns a team/);
  await host.getByRole('button', { name: 'Join Team Marigold' }).click();
  const [meera, bilal, chitra] = guests as [Page, Page, Page];
  await meera.goto(path);
  await meera.getByRole('button', { name: 'Join Team Peacock' }).click();
  await bilal.goto(path);
  await bilal.getByRole('button', { name: 'Join Team Marigold' }).click();
  await chitra.goto(path);
  await chitra.getByRole('button', { name: 'Join Team Peacock' }).click();
  await host.getByRole('button', { name: 'Start the game' }).click();
  await host.getByRole('button', { name: /I’m ready/ }).click();

  const film = (await host.locator('[class*="filmTitle"]').textContent())!;
  expect(film.length).toBeGreaterThan(0);
  for (const p of [meera, bilal, chitra]) {
    await expect(p.getByText('Asha is acting', { exact: true })).toBeVisible();
    await expect(p.getByText(film, { exact: true })).toHaveCount(0);
  }
  // The other team watches; only the acting team may guess.
  await expect(meera.getByPlaceholder('Type the film')).toHaveCount(0);
  await bilal.getByPlaceholder('Type the film').fill(film.toUpperCase());
  await bilal.getByRole('button', { name: 'Guess' }).click();
  for (const p of [host, meera]) await expect(p.getByText('Bilal got it!')).toBeVisible();
  await expect(host.getByRole('region', { name: 'Team Marigold' })).toContainText('1');
});
