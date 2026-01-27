<div align="center">
  <h1>siquil</h1>
  <p><strong>A Safe, Simple SQL Migration Tool for PostgreSQL</strong></p>
  <p>
    <a href="https://www.npmjs.com/package/siquil"><img src="https://img.shields.io/npm/v/siquil.svg" alt="npm version"></a>
    <a href="https://github.com/samueldurantes/siquil/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/siquil.svg" alt="license"></a>
  </p>
</div>

---

Siquil is a simple SQL migration tool for PostgreSQL. It runs each migration inside a **transaction**, ensuring your database never ends up in a partially migrated state.

Siquil can be used as a **CLI tool** or as a **library** in your application.

## Getting Started

### Installation

```bash
npm install -g siquil
```

### Configuration

Set your database connection:

```bash
export DATABASE_URL=postgres://user:password@localhost:5432/mydb
```

Optionally, create a `siquil.toml` in your project root:

```toml
migrations_dir = "migrations"
```

### Initialize your project

```bash
siquil database setup
```

This creates the migrations directory and the `__siquil_migrations` tracking table.

## Code Examples

### Generating migrations

```bash
$ siquil migration generate create_users

Created migration: 20260127225011_create_users
```

This creates the following structure:

```
migrations/
└── 20260127225011_create_users/
    ├── up.sql
    └── down.sql
```

### Writing migrations

Edit `up.sql`:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Edit `down.sql`:

```sql
DROP TABLE users;
```

### Running migrations

```bash
$ siquil migration run

Running migration: 20260127225011_create_users
  Applied successfully

Applied 1 migration(s)
```

### Reverting migrations

```bash
$ siquil migration revert

Reverting migration: 20260127225011_create_users
  Reverted successfully
```

### Resetting the database

```bash
$ siquil database reset

Dropping all tables...
Migrations table recreated
Running migration: 20260127225011_create_users
  Applied successfully

Applied 1 migration(s)
```

## Using as a Library

Siquil can also be used programmatically in your application:

```typescript
import { Pool } from 'pg';
import { runPendingMigrations } from 'siquil';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const applied = await runPendingMigrations(pool, './migrations');

  for (const migration of applied) {
    console.log(`Applied: ${migration.version}_${migration.name}`);
  }

  await pool.end();
}

main();
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `siquil database setup` | Initialize migrations table and run pending migrations |
| `siquil database reset` | Drop all tables and re-run all migrations |
| `siquil migration generate <name>` | Create a new migration |
| `siquil migration run` | Run all pending migrations |
| `siquil migration revert` | Revert the last applied migration |

## License

Licensed under the MIT License. See [LICENSE](LICENSE) for details.
