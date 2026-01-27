import * as fs from "fs";
import * as path from "path";
import { Command } from "commander";
import { loadConfig, getMigrationsDir } from "../utils/config";
import {
  ensureMigrationsTable,
  getPendingMigrations,
  runMigration,
  revertMigration,
  getLastAppliedMigration,
  generateTimestamp,
} from "../utils/migrations";
import { closePool } from "../db/connection";

export function registerMigrationCommands(program: Command): void {
  const migration = program.command("migration").description("Manage migrations");

  migration
    .command("generate <name>")
    .description("Generate a new migration")
    .action(async (name: string) => {
      try {
        const config = loadConfig();
        const migrationsDir = getMigrationsDir(config);

        if (!fs.existsSync(migrationsDir)) {
          fs.mkdirSync(migrationsDir, { recursive: true });
        }

        const timestamp = generateTimestamp();
        const migrationName = `${timestamp}_${name}`;
        const migrationPath = path.join(migrationsDir, migrationName);

        fs.mkdirSync(migrationPath);
        fs.writeFileSync(path.join(migrationPath, "up.sql"), "-- Your SQL goes here\n");
        fs.writeFileSync(path.join(migrationPath, "down.sql"), "-- This file should undo anything in `up.sql`\n");

        console.log(`Created migration: ${migrationName}`);
      } catch (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
      }
    });

  migration
    .command("run")
    .description("Run all pending migrations")
    .action(async () => {
      try {
        const config = loadConfig();
        const migrationsDir = getMigrationsDir(config);

        await ensureMigrationsTable();
        const pending = await getPendingMigrations(migrationsDir);

        if (pending.length === 0) {
          console.log("No pending migrations");
          await closePool();
          return;
        }

        for (const migration of pending) {
          console.log(`Running migration: ${migration.version}_${migration.name}`);
          await runMigration(migration);
          console.log(`  Applied successfully`);
        }

        console.log(`\nApplied ${pending.length} migration(s)`);
        await closePool();
      } catch (error) {
        console.error(`Error: ${error}`);
        await closePool();
        process.exit(1);
      }
    });

  migration
    .command("revert")
    .description("Revert the last migration")
    .action(async () => {
      try {
        const config = loadConfig();
        const migrationsDir = getMigrationsDir(config);

        await ensureMigrationsTable();
        const last = await getLastAppliedMigration(migrationsDir);

        if (!last) {
          console.log("No migrations to revert");
          await closePool();
          return;
        }

        console.log(`Reverting migration: ${last.version}_${last.name}`);
        await revertMigration(last);
        console.log(`  Reverted successfully`);

        await closePool();
      } catch (error) {
        console.error(`Error: ${error}`);
        await closePool();
        process.exit(1);
      }
    });
}
