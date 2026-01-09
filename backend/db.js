import pkg from 'pg';
const { Pool } = pkg;

const {
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
} = process.env;

if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
  throw new Error('Database credentials are missing. Check Render env vars.');
}

export const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT || 5432,
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false, // REQUIRED on Render
  },
});

export async function checkDb() {
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  console.log('✅ Database connected');
}