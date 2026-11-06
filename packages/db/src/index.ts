// Runtime entry: connection only. Migrations live at `@diwali/db/migrate` so
// application bundles never pull in filesystem code.
export { createSql, type Sql, type SqlOptions, type TransactionSql } from './client.ts';
