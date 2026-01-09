import express from 'express';
import { checkDb, pool } from './db.js';
import fs from 'fs';
import path from 'path';
import authRoutes from "./routes/auth.js";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');

  // ✅ Do NOT crash if migrations folder is missing
  if (!fs.existsSync(migrationsDir)) {
    console.log('ℹ️ No migrations folder found, skipping migrations');
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(
      path.join(migrationsDir, file),
      'utf8'
    );
    await pool.query(sql);
    console.log(`✅ Migration applied: ${file}`);
  }
}

async function start() {
  await checkDb();
  await runMigrations(); // 🔥 auto-run safely
  app.use(express.json());
  app.use("/auth", authRoutes);
  app.listen(PORT, () => {
    console.log(`🚀 Predix backend running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('❌ Startup failed:', err);
  process.exit(1);
});