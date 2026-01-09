import pg from 'pg';
const { Pool } = pg;

const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number.isNaN(dbPort) ? 5432 : dbPort,
  database: process.env.DB_NAME || 'predix',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

export async function checkConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
}

export default pool;
