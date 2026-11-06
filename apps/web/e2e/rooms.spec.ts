import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { hostParty, joinParty } from './helpers';

// The Rangoli Courtyard, the Music Mehfil and Diwali Daak, used by a host and
// two guests of one party. Removing a guest, last, must shut every room to them.
test.describe.configure({ mode: 'serial' });

let host: Page;
let guest: Page;
let cousin: Page;
let courtyard = '';
let mehfil = '';
let daak = '';
let daakApi = '';

test.beforeAll(async ({ browser }) => {
  host = await (await browser.newContext()).newPage();
  const { code, partyId } = await hostParty(host, 'House night', 'Asha');
  const ticket = await host.request.post(`/api/parties/${partyId}/ticket`);
  test.skip(ticket.status() === 503, 'Realtime keys are not configured on this machine.');
  guest = (await joinParty(browser, code, 'Meera')).page;
  cousin = (await joinParty(browser, code, 'Bilal')).page;
  courtyard = `/party/${partyId}/courtyard`;
  mehfil = `/party/${partyId}/mehfil`;
  daak = `/party/${partyId}/daak`;
  daakApi = `/api/parties/${partyId}/daak`;
});

/** Draws with the mouse, through points in rangoli units (the disc's radius is 1000). */
async function draw(page: Page, points: Array<[number, number]>) {
  const floor = page.locator('canvas[data-drawing]');
  await floor.scrollIntoViewIfNeeded();
  const box = (await floor.boundingBox())!;
  const at = ([x, y]: [number, number]) =>
    [box.x + ((x / 1000 + 1) / 2) * box.width, box.y + ((y / 1000 + 1) / 2) * box.height] as const;
  await page.mouse.move(...at(points[0]!));
  await page.mouse.down();
  for (const point of points.slice(1)) await page.mouse.move(...at(point), { steps: 5 });
  await page.mouse.up();
}

async function pick(page: Page, ...names: string[]) {
  for (const name of names) {
    await page.getByRole('radio', { name, exact: true }).check({ force: true });
  }
}

/** How opaque the painted strokes are at a point (0 = bare floor). */
function inkAt(page: Page, [x, y]: [number, number]) {
  return page.evaluate(
    ([x, y]) => {
      const canvas = document.querySelector<HTMLCanvasElement>('canvas:not([data-drawing])')!;
      const px = Math.round(((x / 1000 + 1) / 2) * canvas.width);
      const py = Math.round(((y / 1000 + 1) / 2) * canvas.height);
      return canvas.getContext('2d')!.getImageData(px, py, 1, 1).data[3];
    },
    [x, y] as const,
  );
}

const count = (page: Page) => page.getByTestId('courtyard-count');

/**
 * YouTube's player script, replaced by a stand-in that records what it was
 * asked to play and can end a song, or fail one, on cue.
 */
const FAKE_YOUTUBE = `
  window.__players = [];
  window.YT = {
    PlayerState: { ENDED: 0 },
    Player: class {
      constructor(element, options) {
        this.options = options;
        this.video = options.videoId ?? null;
        window.__players.push(this);
        setTimeout(() => options.events.onReady({ target: this }), 0);
      }
      loadVideoById(video) { this.video = video; }
      playVideo() {}
      stopVideo() { this.video = null; }
      destroy() {}
      end() { this.options.events.onStateChange({ data: 0 }); }
      fail() { this.options.events.onError({ data: 150 }); }
    },
  };
  window.onYouTubeIframeAPIReady?.();
`;

type FakePlayer = { video: string | null; end(): void; fail(): void };
const player = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __players?: FakePlayer[] }).__players?.at(-1)?.video ?? null,
  );
const control = (page: Page, what: 'end' | 'fail') =>
  page.evaluate(
    (w) => (window as unknown as { __players: FakePlayer[] }).__players.at(-1)![w](),
    what,
  );

async function requestSong(page: Page, url: string, dedication?: string) {
  await page.getByLabel('YouTube link').fill(url);
  if (dedication) await page.getByLabel('Dedication (optional)').fill(dedication);
  await page.getByRole('button', { name: 'Request it' }).click();
}

const upNext = (page: Page) => page.getByRole('region', { name: 'Up next' }).getByRole('listitem');

test('the courtyard opens from the party hall', async () => {
  await host.getByRole('link', { name: /Rangoli Courtyard/ }).click();
  await host.waitForURL(/\/courtyard$/);
  await expect(host.getByText(/Drag to draw/)).toBeVisible();
  await guest.goto(courtyard);
  await expect(count(guest)).toHaveText(/An empty floor/);
});

test('a stroke drawn by one guest reaches everyone, mirrored all the way round', async () => {
  await pick(guest, 'Dot', 'Vermilion', 'Bold');
  await draw(guest, [[0, -500]]);
  await expect(count(host)).toHaveText('1 stroke by 1 person · 8-fold');
  // Eight-fold and mirrored: the same dot at the top, bottom, left and right.
  await expect.poll(() => inkAt(host, [0, -500])).toBe(255);
  for (const point of [
    [0, 500],
    [500, 0],
    [-500, 0],
  ] as Array<[number, number]>) {
    expect(await inkAt(host, point)).toBe(255);
  }
  expect(await inkAt(host, [0, -250])).toBe(0);
  await expect(host.getByRole('region', { name: 'Host tools' })).toContainText('Meera · 1');
  await expect(guest.getByRole('region', { name: 'Host tools' })).toHaveCount(0);
});

test('people can undo only their own strokes', async () => {
  await pick(host, 'Petal', 'Teal');
  await draw(host, [
    [0, -150],
    [0, -420],
  ]);
  await expect(count(guest)).toHaveText('2 strokes by 2 people · 8-fold');
  await guest.getByRole('button', { name: 'Undo my last stroke' }).click();
  await expect(count(host)).toHaveText('1 stroke by 1 person · 8-fold');
  await expect(guest.getByRole('button', { name: 'Undo my last stroke' })).toBeDisabled();
});

test('the host can remove a guest’s strokes and save the rangoli as an image', async () => {
  await pick(guest, 'Ring', 'Turmeric');
  await draw(guest, [[0, -700]]);
  await pick(guest, 'Line', 'Rose');
  await draw(guest, [
    [100, -600],
    [200, -650],
    [300, -560],
  ]);
  await expect(count(host)).toHaveText('3 strokes by 2 people · 8-fold');

  await host.getByRole('button', { name: 'Remove Meera’s strokes' }).click();
  await host.getByRole('dialog').getByRole('button', { name: 'Remove strokes' }).click();
  await expect(count(guest)).toHaveText('1 stroke by 1 person · 8-fold');
  expect(await inkAt(guest, [0, -700])).toBe(0);

  const download = host.waitForEvent('download');
  await host.getByRole('button', { name: 'Save as image' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('diwali-house-rangoli.png');
  const bytes = await readFile((await file.path())!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.length).toBeGreaterThan(10_000);
});

test('the Mehfil checks every request with YouTube and keeps its dedication', async () => {
  await guest.goto(mehfil);
  await requestSong(guest, 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');
  await expect(guest.getByText(/doesn’t look like a YouTube link/)).toBeVisible();
  await requestSong(guest, 'https://youtu.be/noEmbed0000');
  await expect(guest.getByText(/doesn’t allow it to play outside YouTube/)).toBeVisible();
  await requestSong(guest, 'https://youtu.be/mehfilSongA?si=shared', 'For Nani');
  await expect(guest.getByText('Requested “Test song A”.')).toBeVisible();

  await host.goto(mehfil);
  await expect(upNext(host)).toHaveCount(1);
  await expect(upNext(host).first()).toContainText('Test song A');
  await expect(upNext(host).first()).toContainText('Meera · For Nani');
});

test('votes decide what plays next, and nobody votes for their own request', async () => {
  await requestSong(guest, 'https://www.youtube.com/watch?v=mehfilSongB');
  await cousin.goto(mehfil);
  await requestSong(cousin, 'https://music.youtube.com/watch?v=mehfilSongC');
  await expect(upNext(guest)).toHaveCount(3);
  await expect(guest.getByRole('button', { name: /Vote for Test song A/ })).toHaveCount(0);
  await guest.getByRole('button', { name: 'Vote for Test song C' }).click();
  await expect(upNext(host).first()).toContainText('Test song C');
  await expect(host.getByRole('button', { name: 'Vote for Test song C' })).toHaveText('1');
});

test('one device plays the music, and the queue moves as each song ends', async () => {
  await host.route('https://www.youtube.com/iframe_api', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: FAKE_YOUTUBE }),
  );
  await expect(guest.getByRole('button', { name: 'Play the music on this device' })).toHaveCount(0);
  await host.getByRole('button', { name: 'Play the music on this device' }).click();
  await expect.poll(() => player(host)).toBe('mehfilSongC');
  await expect(guest.getByTestId('now-playing')).toHaveText('Test song C');
  await expect(guest.getByText('Playing on Asha’s device')).toBeVisible();

  await control(host, 'end');
  await expect(guest.getByTestId('now-playing')).toHaveText('Test song A');
  await expect.poll(() => player(host)).toBe('mehfilSongA');
  await expect(guest.getByRole('region', { name: 'Recently played' })).toContainText('Test song C');

  // A song YouTube refuses to play is skipped, and the speaker says why.
  await control(host, 'fail');
  await expect(host.getByText('Skipped “Test song A”: YouTube won’t play it here.')).toBeVisible();
  await expect(guest.getByTestId('now-playing')).toHaveText('Test song B');

  await expect(guest.getByRole('button', { name: 'Skip this song' })).toHaveCount(0);
  await host.getByRole('button', { name: 'Skip this song' }).click();
  await expect(guest.getByText('The queue is empty. Request a song below.')).toBeVisible();
});

test('postcards reach everyone, in any script', async () => {
  await guest.goto(daak);
  await expect(guest.getByText('The letterbox is empty.', { exact: false })).toBeVisible();
  await guest.getByLabel('To (optional)').fill('Nani');
  await guest.getByLabel('Message').fill('दीपावली की हार्दिक शुभकामनाएँ! 🪔');
  await guest.locator('label', { hasText: 'Rangoli' }).click();
  await guest.getByRole('button', { name: 'Post it' }).click();
  await expect(guest.getByText('Posted! It’s on the wall.')).toBeVisible();

  await host.goto(daak);
  const card = host.getByRole('article', { name: 'Postcard from Meera' });
  await expect(card).toContainText('दीपावली की हार्दिक शुभकामनाएँ! 🪔');
  await expect(card).toContainText('Nani');
  // The writer's script is marked, though their language can't be known.
  await expect(card.locator('[lang="und-Deva"]').first()).toBeVisible();
});

test('a postcard the host hides never reaches the other guests', async () => {
  await cousin.goto(daak);
  await cousin.getByLabel('Message').fill('A joke the host would rather not see');
  await cousin.getByRole('button', { name: 'Post it' }).click();
  await expect(cousin.getByText('Posted! It’s on the wall.')).toBeVisible();

  await host.reload();
  await host.getByRole('button', { name: 'Hide Bilal’s postcard' }).click();
  await expect(host.getByText('Hidden from guests.')).toBeVisible();

  // Left out by the server, not hidden by the page: the guest's own API call never has it.
  const seen = await guest.request.get(daakApi);
  expect(seen.status()).toBe(200);
  expect(await seen.text()).not.toContain('A joke the host would rather not see');
  await guest.reload();
  await expect(guest.getByRole('article', { name: 'Postcard from Bilal' })).toHaveCount(0);
  // The writer is told what happened to their card.
  await cousin.reload();
  await expect(cousin.getByText('The host has hidden this card from the party.')).toBeVisible();
});

test('a postcard can be taken down by its writer only', async () => {
  await expect(guest.getByRole('button', { name: 'Withdraw' })).toHaveCount(1);
  await expect(host.getByRole('article', { name: 'Postcard from Meera' })).toBeVisible();
  await cousin.getByRole('button', { name: 'Withdraw' }).click();
  await cousin.getByRole('dialog').getByRole('button', { name: 'Take it down' }).click();
  await expect(cousin.getByRole('article', { name: 'Postcard from Bilal' })).toHaveCount(0);
  await host.reload();
  await expect(host.getByRole('article', { name: 'Postcard from Bilal' })).toHaveCount(0);
});

test('the guestbook is closed to anyone outside the party', async ({ browser }) => {
  const stranger = await browser.newContext();
  const response = await stranger.request.get(daakApi);
  expect(response.status()).toBe(401);
  expect(await response.text()).not.toContain('शुभकामनाएँ');
  const page = await stranger.newPage();
  await page.goto(daak);
  await expect(page.getByRole('heading', { name: 'This door is closed' })).toBeVisible();
  await stranger.close();
});

test('removing a guest closes every room to them, and takes their postcards down', async () => {
  await host.goto(courtyard);
  await guest.goto(courtyard);
  const guestMehfil = await guest.context().newPage();
  await guestMehfil.goto(mehfil);
  await expect(guestMehfil.getByRole('heading', { name: 'Up next' })).toBeVisible();
  const guestDaak = await guest.context().newPage();
  await guestDaak.goto(daak);
  await expect(guestDaak.getByRole('heading', { name: 'On the wall' })).toBeVisible();
  const hall = await host.context().newPage();
  await hall.goto(courtyard.replace(/\/courtyard$/, ''));
  await hall
    .getByRole('listitem')
    .filter({ hasText: 'Meera' })
    .getByRole('button', { name: 'Remove' })
    .click();
  await hall.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  // The courtyard doesn't poll: only the realtime revocation can tell it.
  await expect(guest.getByRole('heading', { name: 'You are no longer in this party' })).toBeVisible(
    {
      timeout: 5_000,
    },
  );
  await expect(guest.locator('canvas')).toHaveCount(0);
  await expect(
    guestMehfil.getByRole('heading', { name: 'You are no longer in this party' }),
  ).toBeVisible({ timeout: 5_000 });
  await expect(host.getByRole('region', { name: 'In the courtyard now' })).not.toContainText(
    'Meera',
  );
  // The Daak isn't realtime; its next refresh finds the session gone.
  await expect(
    guestDaak.getByRole('heading', { name: 'You are no longer in this party' }),
  ).toBeVisible({ timeout: 15_000 });
  await host.goto(daak);
  await expect(host.getByRole('article', { name: 'Postcard from Meera' })).toHaveCount(0);
});
