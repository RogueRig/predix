import express from 'express';
import { checkConnection } from './db.js';

const app = express();
const PORT = Number.parseInt(process.env.PORT ?? '', 10) || 3000;

app.use(express.json());

app.get('/api/db-check', async (req, res) => {
  try {
    await checkConnection();
    res.json({ db: 'connected' });
  } catch (error) {
    console.error('Database connection check failed:', error);
    res.status(500).json({ 
      error: 'Database connection failed'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
