// Smoke test for the realtime Worker running under `wrangler dev`.
//
//   pnpm --filter @diwali/realtime dev     (in one terminal)
//   pnpm --filter @diwali/realtime smoke   (in another)
//
// Signs tickets with the dev private key, creates a table over the party
// socket, seats two players, plays a hand, draws in the courtyard, checks
// that the Worker refuses missing, wrong-party and replayed tickets, and
// that a revocation notice shuts a member out of every room. Exits non-zero
// on failure.
import { readFileSync } from 'node:fs';
import { signRevocation, signTicket } from '@diwali/realtime-protocol';

const BASE = process.env.REALTIME_URL ?? 'ws://localhost:8787';
const env = readFileSync(new URL('../../web/.env.local', import.meta.url), 'utf8');
const privateJwk = JSON.parse(/^REALTIME_PRIVATE_KEY='(.*)'$/m.exec(env)[1]);
const party = `smoke-${Math.random().toString(36).slice(2, 10)}`;

const people = {
  asha: { member: 'm-asha', role: 'host', name: 'Asha', emblem: 'diya' },
  meera: { member: 'm-meera', role: 'guest', name: 'Meera', emblem: 'kamal' },
};

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}`);
  if (!ok) failures++;
};

const ticket = (who, forParty = party) =>
  signTicket(privateJwk, {
    v: 1,
    party: forParty,
    ...people[who],
    exp: Date.now() + 60_000,
    jti: crypto.randomUUID(),
  });

/** Opens a socket and returns helpers to await messages and send requests. */
function connect(path, token, query = '') {
  const ws = new WebSocket(`${BASE}${path}?ticket=${encodeURIComponent(token)}${query}`);
  const inbox = [];
  const waiters = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    inbox.push(message);
    for (const w of [...waiters])
      if (w.test(message)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(message);
      }
  });
  const next = (test, label) =>
    new Promise((resolve, reject) => {
      const found = inbox.find(test);
      if (found) {
        inbox.splice(inbox.indexOf(found), 1);
        return resolve(found);
      }
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), 5000);
      waiters.push({
        test,
        resolve: (m) => {
          clearTimeout(timer);
          inbox.splice(inbox.indexOf(m), 1);
          resolve(m);
        },
      });
    });
  let n = 0;
  const request = async (body) => {
    const id = `smoke_${(++n).toString().padStart(6, '0')}`;
    ws.send(JSON.stringify({ ...body, id }));
    return next((m) => m.t === 'result' && m.id === id, `result ${id}`);
  };
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error(`could not open ${path}`)), { once: true });
  });
  return { ws, opened, next, request, inbox };
}

const connectDevice = (path, token, device) => connect(path, token, `&device=${device}`);

/** A connection attempt that should be refused. Resolves true if it was. */
function refused(path, token, query = '') {
  return new Promise((resolve) => {
    const ws = new WebSocket(
      `${BASE}${path}${token === null ? '' : `?ticket=${encodeURIComponent(token)}`}${query}`,
    );
    ws.addEventListener('open', () => {
      ws.close();
      resolve(false);
    });
    ws.addEventListener('error', () => resolve(true));
  });
}

/** Waits for the table to settle, then returns the newest view received. */
const latestView = async (socket) => {
  await new Promise((r) => setTimeout(r, 250));
  const views = socket.inbox.filter((m) => m.t === 'view');
  if (views.length === 0) return socket.next((m) => m.t === 'view', 'view');
  for (const v of views) socket.inbox.splice(socket.inbox.indexOf(v), 1);
  return views.at(-1);
};

try {
  console.log(`party ${party}`);
  const lobby = connect(`/parties/${party}/connect`, await ticket('asha'));
  await lobby.opened;
  check('party socket opens with a valid ticket', true);
  const games = await lobby.next((m) => m.t === 'games', 'games');
  check('party room sends the (empty) game directory', games.games.length === 0);
  const presence = await lobby.next((m) => m.t === 'presence', 'presence');
  check(
    'presence lists the host',
    presence.members.some((m) => m.member === 'm-asha'),
  );

  const created = await lobby.request({
    t: 'create-game',
    kind: 'teen-patti',
    options: { boot: 10 },
  });
  check(
    'host opens a Teen Patti table',
    created.ok === true && typeof created.data.game === 'string',
  );
  const tableId = created.data.game;
  const path = `/parties/${party}/games/${tableId}/connect`;

  const asha = connect(path, await ticket('asha'));
  const meera = connect(path, await ticket('meera'));
  await Promise.all([asha.opened, meera.opened]);
  await asha.next((m) => m.t === 'view', 'initial view');
  await meera.next((m) => m.t === 'view', 'initial view');

  check('host sits', (await asha.request({ t: 'action', action: { type: 'sit' } })).ok);
  check('guest sits', (await meera.request({ t: 'action', action: { type: 'sit' } })).ok);
  const notHost = await meera.request({ t: 'action', action: { type: 'deal' } });
  check('a guest cannot deal', notHost.ok === false && notHost.error === 'not-host');
  check('host deals', (await asha.request({ t: 'action', action: { type: 'deal' } })).ok);

  const ashaView = (await latestView(asha)).view;
  const meeraView = (await latestView(meera)).view;
  check(
    'each player starts blind, with no cards shown',
    ashaView.me.cards === null && meeraView.me.cards === null,
  );
  check('the guest (left of dealer) acts first', meeraView.hand.turn === 'm-meera');

  await meera.request({ t: 'action', action: { type: 'see' } });
  const seen = (await latestView(meera)).view;
  check('seeing reveals your own three cards', seen.me.cards?.length === 3);
  const ashaAfter = (await latestView(asha)).view;
  check(
    "the other player's view contains none of them",
    !seen.me.cards.some((c) => JSON.stringify(ashaAfter).includes(`"${c}"`)),
  );

  const betMsg = { t: 'action', id: 'smoke_dupbet01', action: { type: 'bet', amount: 20 } };
  meera.ws.send(JSON.stringify(betMsg));
  meera.ws.send(JSON.stringify(betMsg));
  const r1 = await meera.next((m) => m.t === 'result' && m.id === 'smoke_dupbet01', 'bet result');
  const r2 = await meera.next(
    (m) => m.t === 'result' && m.id === 'smoke_dupbet01',
    'bet result again',
  );
  const afterBet = (await latestView(asha)).view;
  check('a double-sent bet is applied once', r1.ok && r2.ok && afterBet.hand.pot === 40);

  check('host packs', (await asha.request({ t: 'action', action: { type: 'pack' } })).ok);
  const done = (await latestView(meera)).view;
  check(
    'the guest wins the pot',
    done.hand.result?.winners?.[0] === 'm-meera' && done.hand.result.payouts['m-meera'] === 40,
  );

  const directory = await lobby.next(
    (m) => m.t === 'games' && m.games[0]?.players === 2,
    'game status',
  );
  check('the party directory hears the table status', directory.games[0].game === tableId);

  check('no ticket is refused', await refused(path, null));
  check(
    'a ticket for another party is refused',
    await refused(path, await ticket('meera', 'some-other-party')),
  );
  const once = await ticket('meera');
  const first = connect(path, once);
  await first.opened;
  check('a ticket used twice is refused', await refused(path, once));

  // The Rangoli Courtyard: strokes are stamped by the server, stored, shared.
  const yard = `/parties/${party}/courtyard/connect`;
  const yardAsha = connect(yard, await ticket('asha'));
  const empty = await yardAsha.next((m) => m.t === 'courtyard', 'courtyard');
  check('the courtyard sends its rangoli on connect', empty.done && empty.strokes.length === 0);
  const yardMeera = connect(yard, await ticket('meera'));
  await yardMeera.next((m) => m.t === 'courtyard', 'courtyard');
  const petal = { tool: 'petal', colour: 'rose', size: 'medium', points: [0, -100, 0, -400] };
  const drew = await yardMeera.request({ t: 'draw', stroke: petal });
  const heard = await yardAsha.next((m) => m.t === 'drawn', 'drawn');
  check(
    'a stroke reaches everyone, credited to who drew it',
    drew.ok && heard.stroke.by === 'm-meera',
  );
  yardMeera.ws.send(
    JSON.stringify({ t: 'draw', id: 'smoke_forged01', stroke: { ...petal, by: 'm-asha' } }),
  );
  const forged = await yardMeera.next((m) => m.t === 'error', 'error');
  check('a stroke that names its own author is refused', forged.error === 'bad-message');
  const erase = await yardMeera.request({ t: 'erase', member: 'm-asha' });
  check(
    'a guest cannot erase other people’s strokes',
    erase.ok === false && erase.error === 'not-host',
  );
  const later = connect(yard, await ticket('asha'));
  const stored = await later.next((m) => m.t === 'courtyard', 'courtyard');
  check('the rangoli is still there for the next visitor', stored.strokes.length === 1);
  check(
    'a ticket for another party cannot open this courtyard',
    await refused(yard, await ticket('meera', 'some-other-party')),
  );

  // The Music Mehfil: only the host (or their delegate) can be the speaker.
  const hostDeck = connectDevice(
    `/parties/${party}/mehfil/connect`,
    await ticket('asha'),
    'tab_asha_laptop',
  );
  const firstView = await hostDeck.next((m) => m.t === 'mehfil', 'mehfil');
  check(
    'the mehfil sends its queue on connect',
    firstView.view.upNext.length === 0 && firstView.view.playing === null,
  );
  const guestDeck = connectDevice(
    `/parties/${party}/mehfil/connect`,
    await ticket('meera'),
    'tab_meera_phone',
  );
  await guestDeck.next((m) => m.t === 'mehfil', 'mehfil');
  const guestClaim = await guestDeck.request({ t: 'claim' });
  check('a guest cannot make their phone the speaker', guestClaim.error === 'not-host');
  check('the host can', (await hostDeck.request({ t: 'claim' })).ok);
  const speakerView = await hostDeck.next(
    (m) => m.t === 'mehfil' && m.view.speaker,
    'speaker view',
  );
  const guestSees = await guestDeck.next((m) => m.t === 'mehfil' && m.view.speaker, 'speaker view');
  check(
    'and only that tab is told it is the speaker',
    speakerView.you.speaker === true && guestSees.you.speaker === false,
  );
  const notYoutube = await guestDeck.request({ t: 'add', url: 'https://example.com/song.mp3' });
  check('a link that is not YouTube is refused', notYoutube.error === 'not-youtube');
  check(
    'a ticket for another party cannot open this mehfil',
    await refused(
      `/parties/${party}/mehfil/connect`,
      await ticket('meera', 'some-other-party'),
      '&device=tab_meera_phone',
    ),
  );
  check(
    'a malformed device id is refused',
    await refused(`/parties/${party}/mehfil/connect`, await ticket('meera'), '&device=x'),
  );

  // Revocation: the web app says Meera has left. Her sockets close everywhere.
  const notice = (forParty) =>
    signRevocation(privateJwk, {
      v: 1,
      party: forParty,
      member: 'm-meera',
      exp: Date.now() + 60_000,
      jti: crypto.randomUUID(),
    });
  const revokeUrl = `${BASE.replace(/^ws/, 'http')}/parties/${party}/revoke`;
  const post = async (body) => (await fetch(revokeUrl, { method: 'POST', body })).status;
  check(
    'a notice signed for another party is refused',
    (await post(await notice('elsewhere'))) === 401,
  );
  check('a ticket is not accepted as a notice', (await post(await ticket('asha'))) === 401);
  // Told, then shut: the room stops listening to the socket either way.
  const told = (socket) =>
    socket
      .next((m) => m.t === 'revoked', 'revoked')
      .then(() => new Promise((r) => setTimeout(r, 200)))
      .then(() => socket.ws.readyState !== WebSocket.OPEN)
      .catch(() => false);
  const telling = [yardMeera, guestDeck, meera, first].map(told);
  check('a valid notice is accepted', (await post(await notice(party))) === 204);
  const [yardShut, deckShut, ...tableShut] = await Promise.all(telling);
  check('the member’s courtyard socket is told and shut', yardShut);
  check('and their mehfil socket', deckShut);
  check('and both of their table sockets', tableShut.every(Boolean));
  check(
    'and a fresh ticket no longer opens the courtyard',
    await refused(yard, await ticket('meera')),
  );
  check('or the table', await refused(path, await ticket('meera')));
  check('or the party', await refused(`/parties/${party}/connect`, await ticket('meera')));
  check(
    'the host is unaffected',
    !(await refused(yard, await ticket('asha'))) && yardAsha.ws.readyState === WebSocket.OPEN,
  );

  for (const s of [lobby, asha, meera, first, yardAsha, yardMeera, later, hostDeck, guestDeck]) {
    s.ws.close();
  }
} catch (error) {
  console.error(error);
  failures++;
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall realtime checks passed');
process.exit(failures ? 1 : 0);
