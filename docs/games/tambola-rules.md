# Tambola: rules as built

**Status: built 2026-11-05 with the recommended defaults** (the product owner chose "go with the recommended options"). The engine (`packages/tambola`) is tested against this document. Items marked **⚑** are house rules that differ between families; the default is what a new game uses, and variants not listed as settings are not built.

Tambola is played for **points only**. There are no stakes, no buy-ins and nothing of value to win.

## 1. Tickets

| Rule              | Default                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Numbers           | 1 to 90                                                                                                                      |
| Ticket            | 3 rows × 9 columns, 15 numbers, exactly 5 per row. Column 1 holds 1–9, columns 2–8 hold 10–19 … 70–79, column 9 holds 80–90. |
| Column order      | Numbers rise down each column; every column has at least one number                                                          |
| Tickets per guest | 1, chosen by the host when opening the game (1 or 2 in the UI; the engine allows up to 3)                                    |
| Who generates     | The server, with `crypto.getRandomValues`, when the host starts. A guest sees only their own tickets.                        |
| Players           | Up to 50 (the party size). Guests take a ticket before the start; nobody can join once numbers are being called.             |

## 2. Calling

- The **host** calls. Each call draws the next number from a bag shuffled on the server when the game starts. The bag's order never leaves the server.
- The host can switch between **calling by hand** and **calling automatically** every 8 or 12 seconds (the engine accepts 3–60). A Durable Object alarm makes the automatic calls, so they continue if the host's phone sleeps.
- Every guest sees the last number (with its Devanagari numeral), the board of called numbers and how many have been called.

## 3. Marking

- A guest taps a number on their ticket to mark it. Only called numbers can be marked; tapping again unmarks it.
- **Mark for me** marks each called number automatically on that guest's device.
- Marks are a guide. **Claims are checked against the numbers called, not against marks**, so a missed mark never loses a prize. ⚑ Some families require every number to be marked by hand.

## 4. Prizes

| Prize        | Needs                                                 | Points |
| ------------ | ----------------------------------------------------- | -----: |
| Early five   | Any 5 numbers on one ticket                           |     10 |
| Top line     | All 5 numbers in the top row                          |     15 |
| Middle line  | All 5 numbers in the middle row                       |     15 |
| Bottom line  | All 5 numbers in the bottom row                       |     15 |
| Four corners | The first and last numbers of the top and bottom rows |     10 |
| Full house   | All 15 numbers. Winning it ends the game.             |     40 |

- Each prize is won **once**, by the first valid claim the server receives. ⚑ Some families split a prize between claims made on the same number; that is not built.
- A claim can be made any time before the game ends. ⚑ Some families require a claim before the next number is called; that is not built.
- A claim that isn't complete is a **bogey**: it is refused, announced to the table and counted against the guest, with no other penalty. ⚑ Some families void the ticket after a bogey; that is not built.
- If all 90 numbers are called without a full house (only possible when nobody claims), the game ends.

## 5. Fairness and privacy

- Tickets, the bag and claim checks all live in the `GameRoom` Durable Object. Each guest's view contains only their own tickets and marks.
- The host has no view of the bag and cannot choose numbers.
- Claims are validated by `isComplete()`, covered by tests for every prize, for bogeys and for claims on numbers not yet called.
