import express from 'express';
import { checkDb, pool } from './db.js';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 10000;

async function runMigrations() {
  const dir = path.join(process.cwd(), 'backend/migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await pool.query(sql);
    console.log(`✅ Migration applied: ${file}`);
  }
}

async function start() {
  await checkDb();
  await runMigrations(); // 🔥 auto-run
  app.listen(PORT, () => {
    console.log(`🚀 Predix backend running`);
  });
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});