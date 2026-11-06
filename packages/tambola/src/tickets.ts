import type { Rng } from '@diwali/game-kit';

/**
 * 90-ball Tambola tickets: 3 rows × 9 columns, 15 numbers, exactly five per
 * row. Column 0 holds 1–9, column c holds c·10 to c·10+9, and column 8 holds
 * 80–90. Every column has at least one number, numbers rise down each
 * column, and empty cells are null.
 */

export type Ticket = (number | null)[][];

export function columnRange(column: number): [number, number] {
  if (column === 0) return [1, 9];
  if (column === 8) return [80, 90];
  return [column * 10, column * 10 + 9];
}

function pick<T>(items: T[], count: number, rng: Rng): T[] {
  const pool = [...items];
  const chosen: T[] = [];
  for (let i = 0; i < count; i++) chosen.push(pool.splice(rng.int(pool.length), 1)[0]!);
  return chosen;
}

/** Which rows each column's numbers sit in, or null if this attempt boxed itself in. */
function layout(rng: Rng): number[][] | null {
  // Every column gets one; the remaining six go to random columns, max three each.
  const counts = new Array<number>(9).fill(1);
  for (let extra = 0; extra < 6;) {
    const column = rng.int(9);
    if (counts[column]! < 3) {
      counts[column]! += 1;
      extra += 1;
    }
  }
  const rowFill = [0, 0, 0];
  const rows: number[][] = new Array(9);
  // Place the fullest columns first; each goes into the emptiest rows.
  const order = [...Array(9).keys()].sort((a, b) => counts[b]! - counts[a]! || rng.int(3) - 1);
  for (const column of order) {
    const open = [0, 1, 2].filter((r) => rowFill[r]! < 5);
    if (open.length < counts[column]!) return null;
    const leastFull = open.sort((a, b) => rowFill[a]! - rowFill[b]! || rng.int(3) - 1);
    const chosen = leastFull.slice(0, counts[column]!).sort();
    for (const r of chosen) rowFill[r]! += 1;
    rows[column] = chosen;
  }
  return rowFill.every((n) => n === 5) ? rows : null;
}

export function generateTicket(rng: Rng): Ticket {
  for (;;) {
    const rows = layout(rng);
    if (!rows) continue;
    const ticket: Ticket = [0, 1, 2].map(() => new Array<number | null>(9).fill(null));
    rows.forEach((rowIndexes, column) => {
      const [lo, hi] = columnRange(column);
      const span = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
      const numbers = pick(span, rowIndexes.length, rng).sort((a, b) => a - b);
      rowIndexes.forEach((row, i) => {
        ticket[row]![column] = numbers[i]!;
      });
    });
    return ticket;
  }
}

export function ticketNumbers(ticket: Ticket): number[] {
  return ticket.flat().filter((n): n is number => n !== null);
}

export function rowNumbers(ticket: Ticket, row: number): number[] {
  return ticket[row]!.filter((n): n is number => n !== null);
}
