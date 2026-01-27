import * as fs from "fs";
import { Command } from "commander";
import { loadConfig, getMigrationsDir } from "../utils/config";
import {
  ensureMigrationsTable,
  getPendingMigrations,
  runMigration,
  dropAllTables,
  getMigrationsFromDisk,
} from "../utils/migrations";
import { closePool } from "../db/connection";

export function registerDatabaseCommands(program: Command): void {
  const database = program.command("database").alias("db").description("Manage database");

  database
    .command("setup")
    .description("Setup database and run pending migrations")
    .action(async () => {
      try {
        const config = loadConfig();
        const migrationsDir = getMigrationsDir(config);

        if (!fs.existsSync(migrationsDir)) {
          fs.mkdirSync(migrationsDir, { recursive: true });
          console.log(`Created migrations directory: ${config.migrations_dir}`);
        }

        await ensureMigrationsTable();
        console.log("Migrations table ready");

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

  database
    .command("reset")
    .description("Drop all tables and run all migrations")
    .action(async () => {
      try {
        const config = loadConfig();
        const migrationsDir = getMigrationsDir(config);

        console.log("Dropping all tables...");
        await dropAllTables();

        await ensureMigrationsTable();
        console.log("Migrations table recreated");

        const migrations = getMigrationsFromDisk(migrationsDir);

        if (migrations.length === 0) {
          console.log("No migrations to run");
          await closePool();
          return;
        }

        for (const migration of migrations) {
          console.log(`Running migration: ${migration.version}_${migration.name}`);
          await runMigration(migration);
          console.log(`  Applied successfully`);
        }

        console.log(`\nApplied ${migrations.length} migration(s)`);
        await closePool();
      } catch (error) {
        console.error(`Error: ${error}`);
        await closePool();
        process.exit(1);
      }
    });
}
