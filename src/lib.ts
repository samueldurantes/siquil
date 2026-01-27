import * as fs from 'fs';
import * as path from 'path';
import { Pool, PoolClient } from 'pg';

interface Migration {
  version: string;
  name: string;
  path: string;
}

export interface MigrationResult {
  version: string;
  name: string;
}

const MIGRATIONS_TABLE = '__siquil_migrations';

async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version VARCHAR(14) PRIMARY KEY,
      run_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function getMigrationsFromDisk(migrationsDir: string): Migration[] {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  const migrations: Migration[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const match = entry.name.match(/^(\d{14})_(.+)$/);
    if (!match) continue;

    const [, version, name] = match;
    migrations.push({
      version,
      name,
      path: path.join(migrationsDir, entry.name),
    });
  }

  return migrations.sort((a, b) => a.version.localeCompare(b.version));
}

async function getAppliedMigrations(pool: Pool): Promise<string[]> {
  const result = await pool.query(
    `SELECT version FROM ${MIGRATIONS_TABLE} ORDER BY version ASC`
  );
  return result.rows.map((row) => row.version);
}

async function getPendingMigrations(
  pool: Pool,
  migrationsDir: string
): Promise<Migration[]> {
  const applied = await getAppliedMigrations(pool);
  const all = getMigrationsFromDisk(migrationsDir);
  return all.filter((m) => !applied.includes(m.version));
}

/**
 * Run all pending migrations
 * Returns list of applied migrations
 */
export async function runPendingMigrations(
  pool: Pool,
  migrationsDir: string
): Promise<MigrationResult[]> {
  await ensureMigrationsTable(pool);
  const pending = await getPendingMigrations(pool, migrationsDir);
  const applied: MigrationResult[] = [];

  for (const migration of pending) {
    const upPath = path.join(migration.path, 'up.sql');

    if (!fs.existsSync(upPath)) {
      throw new Error(`Missing up.sql in ${migration.path}`);
    }

    const sql = fs.readFileSync(upPath, 'utf-8');

    await withTransaction(pool, async (client: PoolClient) => {
      await client.query(sql);
      await client.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (version) VALUES ($1)`,
        [migration.version]
      );
    });

    applied.push({ version: migration.version, name: migration.name });
  }

  return applied;
}
