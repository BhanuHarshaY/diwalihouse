# Bollywood Dumb Charades: rules as built

**Status: built 2026-11-05 with the recommended defaults** (the product owner chose "go with the recommended options"). The engine (`packages/charades`) is tested against this document. Items marked **⚑** are house rules or planned additions; variants not listed as settings are not built.

The game is played for **points only**.

## 1. Teams

| Rule        | Default                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Teams       | Two: Team Marigold and Team Peacock                                                                      |
| Joining     | Guests pick a team before the start, or are placed in the smaller one; anyone can switch until the start |
| Minimum     | 2 per team (one actor and at least one guesser)                                                          |
| Turns       | 3 per team, alternating (3 or 5 in the UI; the engine allows 1–6)                                        |
| Turn length | 90 seconds (the engine allows 30–180)                                                                    |
| Actor       | Rotates through each team's members in the order they joined                                             |

## 2. A turn

1. The actor is announced. When they are ready, they tap **I'm ready. Show me the film**. The host can start a turn for an actor who is away from their phone.
2. A film title appears **on the actor's phone only**. Everyone sees the number of words, which the actor would signal anyway.
3. The actor acts it out without speaking. The timer runs on the server.
4. The acting team guesses. They can **type** a guess, which the server checks, or **call it out**, and the actor taps **They got it!**
5. The turn ends when the film is guessed (1 point), the actor **passes** (no point), or time runs out (no point). The film is then shown to everyone.

## 3. Guessing

- Only the acting team can type guesses, and the actor can't.
- A typed guess matches when it equals the title or a common short form (DDLJ, K3G, ZNMD, …) after ignoring case, accents and punctuation, with "&" read as "and".
- Wrong typed guesses are shown to the acting team only.
- ⚑ Close-enough matching (typos, missing words) is not built; the actor's **They got it!** covers it.

## 4. Films

- The default deck is **107 well-known Hindi films** across the decades (`packages/charades/src/films.ts`), dealt without repeats within a game.
- ⚑ A host's own list (other languages, family in-jokes) is planned, not built.

## 5. Winning

The team with more points after every turn wins; equal points is a tie.

## 6. Fairness and privacy

- The deck order and the current film live in the `GameRoom` Durable Object. Until the turn ends, the film appears only in the actor's view.
- The host can start, mark or pass a turn for an absent actor, and can move the game on, but can't see the film unless they are the actor.
