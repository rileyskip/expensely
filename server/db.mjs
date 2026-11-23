import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function connectionConfig(connectionString) {
  return { connectionString };
}

let pool;

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing. Run `neon env pull` so .env.local has the pooled Postgres URL.');
  }
  if (!pool) {
    pool = new pg.Pool({
      ...connectionConfig(process.env.DATABASE_URL),
      max: 5,
    });
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

export async function withTransaction(run) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function migrate() {
  if (!process.env.DATABASE_URL_UNPOOLED) {
    throw new Error('DATABASE_URL_UNPOOLED is missing. Schema changes use the direct Postgres URL.');
  }
  const client = new pg.Client(connectionConfig(process.env.DATABASE_URL_UNPOOLED));
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const migrations = ['001_users', '002_ledgers'];
    for (const id of migrations) {
      const existing = await client.query(
        `SELECT 1 FROM schema_migrations WHERE id = $1`,
        [id]
      );
      if (existing.rowCount !== 0) continue;
      const sql = await readFile(path.join(root, 'db/migrations', `${id}.sql`), 'utf8');
      const statements = sql
        .split(/;\s*(?:\n|$)/)
        .map((statement) => statement.trim())
        .filter(Boolean);
      for (const statement of statements) {
        await client.query(statement);
      }
      await client.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [id]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
