import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { PrivyClient } from "@privy-io/server-auth";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

/* ===============================
   Middleware
================================ */
app.use(cors());
app.use(express.json());

/* ===============================
   ENV CHECK
================================ */
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}
if (!process.env.BACKEND_JWT_SECRET) {
  console.error("BACKEND_JWT_SECRET missing");
  process.exit(1);
}
if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
  console.error("PRIVY_APP_ID or PRIVY_APP_SECRET missing");
  process.exit(1);
}

/* ===============================
   Database
================================ */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

/* ===============================
   Privy
================================ */
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

/* ===============================
   Database Migration (BULLETPROOF)
================================ */
async function migrate() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  // USERS
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      privy_user_id TEXT UNIQUE NOT NULL,
      email TEXT,
      wallet_address TEXT,
      balance NUMERIC NOT NULL DEFAULT 1000,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Ensure balance always exists
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS balance NUMERIC NOT NULL DEFAULT 1000;
  `);

  // PORTFOLIO
  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolios (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      market_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      shares NUMERIC NOT NULL,
      avg_price NUMERIC NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log("✅ Database migration complete");
}

await migrate();

/* ===============================
   Auth
================================ */
app.post("/auth/privy", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const verified = await privy.verifyAuthToken(
      auth.replace("Bearer ", "")
    );

    const { rows } = await pool.query(
      `
      INSERT INTO users (privy_user_id, email, wallet_address)
      VALUES ($1, $2, $3)
      ON CONFLICT (privy_user_id)
      DO UPDATE SET
        email = EXCLUDED.email,
        wallet_address = EXCLUDED.wallet_address
      RETURNING *;
      `,
      [
        verified.userId,
        verified.email ?? null,
        verified.wallet?.address ?? null,
      ]
    );

    const token = jwt.sign(
      { uid: rows[0].id },
      process.env.BACKEND_JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    console.error("Auth failed:", err);
    res.status(401).json({ error: "Backend auth failed" });
  }
});

/* ===============================
   JWT Guard
================================ */
function requireBackendAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const decoded = jwt.verify(
      auth.replace("Bearer ", ""),
      process.env.BACKEND_JWT_SECRET
    );

    req.userId = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: "Invalid backend token" });
  }
}

/* ===============================
   Portfolio
================================ */
app.get("/portfolio", requireBackendAuth, async (req, res) => {
  const { rows } = await pool.query(
    `
    SELECT market_id, outcome, shares, avg_price, created_at
    FROM portfolios
    WHERE user_id = $1
    ORDER BY created_at DESC;
    `,
    [req.userId]
  );

  res.json({ portfolio: rows });
});

/* ===============================
   Portfolio Meta (Balance)
================================ */
app.get("/portfolio/meta", requireBackendAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT balance FROM users WHERE id = $1`,
    [req.userId]
  );

  res.json({ balance: Number(rows[0].balance) });
});

/* ===============================
   Paper Trade BUY
================================ */
app.post("/trade/buy", requireBackendAuth, async (req, res) => {
  const { marketId, outcome, shares, price } = req.body;

  if (!marketId || !outcome || !shares || !price) {
    return res.status(400).json({ error: "Invalid trade payload" });
  }

  const cost = Number(shares) * Number(price);

  await pool.query("BEGIN");

  try {
    const balRes = await pool.query(
      `SELECT balance FROM users WHERE id = $1 FOR UPDATE`,
      [req.userId]
    );

    const balance = Number(balRes.rows[0].balance);

    if (balance < cost) {
      await pool.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient balance" });
    }

    await pool.query(
      `
      UPDATE users
      SET balance = balance - $1
      WHERE id = $2;
      `,
      [cost, req.userId]
    );

    await pool.query(
      `
      INSERT INTO portfolios (user_id, market_id, outcome, shares, avg_price)
      VALUES ($1, $2, $3, $4, $5);
      `,
      [req.userId, marketId, outcome, shares, price]
    );

    await pool.query("COMMIT");

    res.json({
      success: true,
      newBalance: Number(balance - cost),
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Trade failed:", err);
    res.status(500).json({ error: "Trade failed" });
  }
});

/* ===============================
   Health
================================ */
app.get("/", (_, res) => {
  res.send("Predix backend running");
});

/* ===============================
   Start
================================ */
app.listen(PORT, () => {
  console.log("🚀 Backend running on", PORT);
});