import express from 'express';
import { checkDb } from './db.js';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

async function start() {
  await checkDb(); // 🔑 wait for DB
  app.listen(PORT, () => {
    console.log(`🚀 Predix backend running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});