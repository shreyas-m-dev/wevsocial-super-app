import fs from 'fs';
import path from 'path';
import { pool } from './pool.js';

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    
    // In production (dist), files are .sql, but in dev they might be read from src
    // They are always .sql files.
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found.');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Alphabetical order

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT id FROM _migrations WHERE name = $1',
        [file]
      );

      if (rows.length === 0) {
        console.log(`Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (name) VALUES ($1)',
          [file]
        );
      } else {
        console.log(`Migration already applied: ${file}`);
      }
    }

    await client.query('COMMIT');
    console.log('All migrations applied successfully.');
  } catch (e: unknown) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
    process.exit(1);
  } finally {
    client.release();
  }
}

// If run directly
if (require.main === module || process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.js')) {
  runMigrations().then(() => pool.end());
}
