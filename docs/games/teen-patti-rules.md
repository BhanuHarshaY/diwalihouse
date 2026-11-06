# Teen Patti: rules and variants

**Status: signed off 2026-11-05.** The product owner accepted every proposed default below. The engine (`packages/teen-patti`) is tested against this document. Items marked **⚑** are house rules that differ between families: the default here is what a new table uses, and each is a per-table setting.

Teen Patti here uses **virtual chips only**. Chips have no cash value, can't be bought, sold or withdrawn, and reset with each party. The product never offers real-money play.

## 1. Table and deal

| Rule              | Proposed default                                                                                                                   | Variants                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Players per table | 3–6 seated (2 allowed for testing and small parties)                                                                               | Up to 7                                                          |
| Deck              | One standard 52-card deck, no jokers                                                                                               | Wild-card variants (Joker, Muflis) are **out of scope for v1**   |
| Shuffle           | Server-side Fisher–Yates driven by `crypto.getRandomValues`, fresh each hand. The seed is kept server-side for audit.              |                                                                  |
| Deal              | 3 cards to each seated player, face down, one at a time, starting left of the dealer                                               |                                                                  |
| Dealer            | Rotates one seat clockwise each hand                                                                                               | ⚑: some families have the previous winner deal                   |
| Boot (ante)       | Every player puts the boot into the pot before the deal. The table's boot is set by the host at table creation (default 10 chips). |                                                                  |
| Starting chips    | Each player gets a table buy-in from the host's setting (default 1,000)                                                            | ⚑: allow top-ups between hands? Proposed: yes, host-configurable |

## 2. Blind and seen

- Each player starts **blind**: they haven't looked at their cards.
- On their turn, or at any time it isn't mid-bet, a player may **see** their cards. They become **seen** permanently for that hand.
- The engine never reveals a blind player's cards to them. Their own private view says `cards: hidden` until they choose _See_.

## 3. Betting

The **current stake** starts at the boot.

| Player is | Minimum bet (_chaal_) | Maximum bet       | Effect on stake                         |
| --------- | --------------------- | ----------------- | --------------------------------------- |
| Blind     | 1 × current stake     | 2 × current stake | If they bet 2×, the stake doubles       |
| Seen      | 2 × current stake     | 4 × current stake | The stake becomes half of what they bet |

On their turn a player may **bet** within those limits, **pack** (fold, forfeiting what they have put in), or, if eligible, request a **show** or a **sideshow**.

| Limit                            | Proposed default                                                   | Notes                                           |
| -------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| Chaal limit (largest single bet) | 128 × boot                                                         | ⚑                                               |
| Pot limit                        | 1,024 × boot. When the pot reaches it, all remaining players show. | ⚑                                               |
| Blind rounds limit               | None                                                               | ⚑: some tables force a see after 4 blind rounds |
| Turn timer                       | 30 s, then auto-pack. Paused while a sideshow is awaiting a reply. | Host-configurable 15–60 s                       |

A player who can't afford the minimum bet may go **all-in** for what they have. The engine then creates a side pot. ⚑: many home games simply forbid betting more than you have. Proposed: forbid, so the player must show if two remain, or pack.

## 4. Show

- Allowed only when **exactly two players remain**.
- Cost: a blind player pays the current stake. A seen player pays 2 × the current stake.
- ⚑: may a seen player call a show against a blind opponent? **Proposed: no.** This follows the most common published rules; the seen player must bet or pack.
- Both hands are revealed to the whole table. The higher hand wins the pot.
- **Equal hands:** ⚑. Proposed: the player who asked for the show loses. Alternative: split the pot.

## 5. Sideshow (compromise)

- Only a **seen** player may request one, only from the **previous active player** (the player who acted just before them), and only if that player is also **seen**.
- Only while **three or more** players remain.
- The requester first places a normal seen bet (2× stake minimum).
- The previous player may **accept** or **decline**. Declining costs nothing, and play continues.
- If accepted, the two hands are compared **privately**: only those two players see both hands. The lower hand packs. **Equal hands:** the requester packs.
- ⚑: is the sideshow enabled at all? Proposed: on, host-toggleable per table.

## 6. Hand ranking (high to low)

1. **Trail (trio):** three of a kind. A-A-A is highest, 2-2-2 lowest.
2. **Pure sequence:** three consecutive cards of one suit.
3. **Sequence (run):** three consecutive cards, mixed suits.
4. **Colour:** three cards of one suit, not consecutive.
5. **Pair:** two of a kind.
6. **High card:** none of the above.

**Sequence order:** A-K-Q is the highest run. ⚑ where **A-2-3** ranks: proposed second highest (just below A-K-Q), the common North Indian rule. The alternative puts it lowest. K-A-2 is never a sequence.

**Comparing within a category:**

- Trails: by rank.
- Sequences and pure sequences: by their top card, using the order above.
- Colour and high card: compare the highest card, then the second, then the third.
- Pair: compare the pair's rank first, then the third card.
- **Suits never break ties.** Identical ranks are equal hands, resolved by the show and sideshow tie rules above.

## 7. End of hand

- The last player not packed wins the pot, or the winner of the show takes it.
- Chips move atomically in the `TableRoom` object. The hand's result (players, pot, winner, revealed hands at showdown) is archived to Postgres. **Unrevealed cards are never archived** in a form other players can read.

## 8. Fairness and privacy requirements (engine tests)

- A blind player's view never contains their cards.
- No view ever contains another player's cards, except both hands in a show (to the whole table) or a sideshow (to its two participants).
- No view contains the deck order or the RNG seed.
- Deals are uniformly distributed: there is a statistical test over a seeded RNG, and a property test that every card is dealt at most once.
- Every transition is a pure function of (state, action, rng), so a hand replays identically from its seed and action log.
- Illegal actions (out of turn, a bet outside the limits, a sideshow against a blind player, a show with three players) are rejected with a typed `RuleViolation`, and state is unchanged.
- A duplicate `requestId` returns the original result and never applies twice.

## Open questions for the product owner

Each **⚑** above, plus:

1. Should _Muflis_ (lowest hand wins) or _Joker_ variants be offered later as table options?
2. Should chips carry over between tables within one party, or should each table have its own stack?
3. Is a spectator view of a table (no cards) wanted, for guests not playing?
