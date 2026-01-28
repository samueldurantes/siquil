import * as fs from "fs";
import * as path from "path";
import { PoolClient } from "pg";
import { getPool, withTransaction } from "../db/connection";

export interface Migration {
  version: string;
  name: string;
  path: string;
}

const MIGRATIONS_TABLE = "__siquil_migrations";

export async function ensureMigrationsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version VARCHAR(14) PRIMARY KEY,
      run_on TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function getAppliedMigrations(): Promise<string[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT version FROM ${MIGRATIONS_TABLE} ORDER BY version ASC`
  );
  return result.rows.map((row) => row.version);
}

export function getMigrationsFromDisk(migrationsDir: string): Migration[] {
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

export async function getPendingMigrations(
  migrationsDir: string
): Promise<Migration[]> {
  const applied = await getAppliedMigrations();
  const all = getMigrationsFromDisk(migrationsDir);
  return all.filter((m) => !applied.includes(m.version));
}

export async function runMigration(migration: Migration): Promise<void> {
  const upPath = path.join(migration.path, "up.sql");

  if (!fs.existsSync(upPath)) {
    throw new Error(`Missing up.sql in ${migration.path}`);
  }

  const sql = fs.readFileSync(upPath, "utf-8");

  await withTransaction(async (client: PoolClient) => {
    await client.query(sql);
    await client.query(
      `INSERT INTO ${MIGRATIONS_TABLE} (version) VALUES ($1)`,
      [migration.version]
    );
  });
}

export async function revertMigration(migration: Migration): Promise<void> {
  const downPath = path.join(migration.path, "down.sql");

  if (!fs.existsSync(downPath)) {
    throw new Error(`Missing down.sql in ${migration.path}`);
  }

  const sql = fs.readFileSync(downPath, "utf-8");

  await withTransaction(async (client: PoolClient) => {
    await client.query(sql);
    await client.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE version = $1`, [
      migration.version,
    ]);
  });
}

export async function getLastAppliedMigration(
  migrationsDir: string
): Promise<Migration | null> {
  const applied = await getAppliedMigrations();
  if (applied.length === 0) return null;

  const lastVersion = applied[applied.length - 1];
  const all = getMigrationsFromDisk(migrationsDir);
  return all.find((m) => m.version === lastVersion) || null;
}

export async function dropAllTables(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
  `);
}

export function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}
