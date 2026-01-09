import fs from 'fs';
import path from 'path';
import { pool } from './db.js';

const migrationsDir = path.join(process.cwd(), 'backend/migrations');

async function runMigrations() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`📄 Running ${file}`);
    await pool.query(sql);
  }

  console.log('✅ Migrations complete');
  process.exit(0);
}

runMigrations().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});