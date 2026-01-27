#!/usr/bin/env node

import { Command } from 'commander';
import { registerMigrationCommands } from './commands/migration';
import { registerDatabaseCommands } from './commands/database';

const program = new Command();

program
  .name('siquil')
  .description('Simple SQL migration tool for PostgreSQL')
  .version('1.0.0');

registerMigrationCommands(program);
registerDatabaseCommands(program);

program.parse();
