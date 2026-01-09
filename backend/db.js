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

let poolEnded = false;

async function shutdownPool(signal) {
  if (poolEnded) {
    return;
  }
  poolEnded = true;
  try {
    await pool.end();
  } catch (err) {
    // Optionally log the error; avoid throwing during shutdown
    // console.error(`Error closing DB pool on ${signal}:`, err);
  }
}

const terminationSignals = ['SIGINT', 'SIGTERM'];
terminationSignals.forEach((signal) => {
  process.on(signal, () => {
    shutdownPool(signal).finally(() => {
      // Allow default behavior after cleanup
      process.exit(0);
    });
  });
});

process.on('beforeExit', () => {
  // Ensure pool is closed when Node is about to exit naturally
  shutdownPool('beforeExit');
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
