import pg from 'pg';
const { Pool } = pg;

const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;

const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;

if (!dbUser || !dbPassword) {
  throw new Error('Database credentials must be set via DB_USER and DB_PASSWORD environment variables.');
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'predix',
  user: dbUser,
  password: dbPassword,
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
