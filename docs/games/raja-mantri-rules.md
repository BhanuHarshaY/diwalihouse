# Raja Mantri Chor Sipahi: rules as built

**Status: built 2026-11-05 with the recommended defaults** (the product owner chose "go with the recommended options"). The engine (`packages/raja-mantri`) is tested against this document. Items marked **⚑** are house rules that differ between families; the default is what a new game uses, and variants not listed as settings are not built.

The game is played for **points only**.

## 1. Setup

| Rule    | Default                                                                                |
| ------- | -------------------------------------------------------------------------------------- |
| Players | Exactly 4. The game can't start with fewer, and a fifth person can watch.              |
| Rounds  | 5, chosen by the host when opening the game (3 or 5 in the UI; the engine allows 1–10) |
| Chits   | Raja, Mantri, Chor and Sipahi, shuffled on the server and dealt one to each player     |

## 2. A round

1. The chits are dealt. Each player sees their own chit.
2. The **Raja** and the **Mantri** are revealed to everyone. ("Mantri, find the Chor!")
3. The **Mantri** chooses which of the two hidden players is the Chor. Only the Mantri can accuse, and only one of those two.
4. Every chit is revealed and the round is scored.
5. The host moves on to the next round, which deals fresh chits.

## 3. Points

| Chit   | Points |
| ------ | -----: |
| Raja   |  1,000 |
| Mantri |    800 |
| Sipahi |    500 |
| Chor   |      0 |

- **The Mantri is right:** everyone scores their chit.
- **The Mantri is wrong:** the Mantri scores 0 and the Chor takes the Mantri's 800.
- ⚑ Some families swap the Mantri's and the Chor's points instead, or give the Sipahi the guessing role. Neither is built.

After the last round the highest total wins; a tie names every leader.

## 4. Fairness and privacy

- The shuffle runs in the `GameRoom` Durable Object. While the Mantri is choosing, no view contains the Chor's or the Sipahi's identity, except each of them seeing their own chit.
- The host plays like anyone else and sees only their own chit.
- Players can't leave mid-game. If the Mantri drops out, the round waits for them to come back; ⚑ a host "end game" control is not built yet.
