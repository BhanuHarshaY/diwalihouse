import postgres from 'postgres';

export type Sql = postgres.Sql;
export type TransactionSql = postgres.TransactionSql;

export interface SqlOptions {
  /** Postgres connection string. */
  url: string;
  /**
   * Set when connecting through a transaction-mode pooler (Supabase
   * Supavisor on :6543). Such poolers cannot hold prepared statements.
   */
  pooled?: boolean;
  /** Maximum connections held by this process. */
  max?: number;
}

export function createSql({ url, pooled = false, max = 10 }: SqlOptions): Sql {
  return postgres(url, {
    max,
    prepare: !pooled,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
    connection: { application_name: 'diwali-house' },
  });
}
