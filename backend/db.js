const { Pool } = require('pg');

// Create a connection pool using DATABASE_URL from environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Handle SSL configuration based on environment
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: true }
    : process.env.DATABASE_URL?.includes('localhost') 
    ? false 
    : { rejectUnauthorized: true }
});

// Handle pool errors gracefully
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Log the error but don't crash the application
  // The pool will handle reconnection automatically
});

// Export a query helper function
const query = async (text, params) => {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

module.exports = {
  query,
  pool
};
