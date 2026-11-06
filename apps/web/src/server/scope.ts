import type { Sql, TransactionSql } from '@diwali/db';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Runs `work` inside a transaction that can only see one party's rows.
 *
 * Postgres enforces this, not the caller: the transaction switches to the
 * `diwali_party_scope` role, whose row-level-security policies compare every
 * row's party against `diwali.party_id`. Both settings are `LOCAL`, so they
 * end with the transaction and cannot leak into a pooled connection.
 */
export async function withPartyScope<T>(
  sql: Sql,
  partyId: string,
  work: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  if (!isUuid(partyId)) throw new TypeError('withPartyScope requires a party UUID');
  return (await sql.begin(async (tx) => {
    await enterPartyScope(tx, partyId);
    return work(tx);
  })) as T;
}

/** Narrows an already-open transaction to one party. Cannot be undone within it. */
export async function enterPartyScope(tx: TransactionSql, partyId: string): Promise<void> {
  await tx`select set_config('diwali.party_id', ${partyId}, true)`;
  await tx`set local role diwali_party_scope`;
}
