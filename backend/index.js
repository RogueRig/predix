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
for (const v of [
  "DATABASE_URL",
  "BACKEND_JWT_SECRET",
  "PRIVY_APP_ID",
  "PRIVY_APP_SECRET",
]) {
  if (!process.env[v]) {
    console.error(`${v} missing`);
    process.exit(1);
  }
}

/* ===============================
   Database
================================ */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/* ===============================
   Privy
================================ */
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

/* ===============================
   SAFE MIGRATION (DEV FIX)
================================ */
async function migrate() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolios (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      market_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      shares NUMERIC NOT NULL,
      avg_price NUMERIC NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      idempotency_key TEXT
    );
  `);

  // ✅ DEV-ONLY BALANCE FIX
  await pool.query(`
    UPDATE users
    SET balance = 1000
    WHERE balance = 0;
  `);

  console.log("✅ Migration + balance backfill complete");
}

await migrate();

/* ===============================
   Auth
================================ */
app.post("/auth/privy", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const verified = await privy.verifyAuthToken(auth.replace("Bearer ", ""));

  const { rows } = await pool.query(
    `
    INSERT INTO users (privy_user_id, email, wallet_address)
    VALUES ($1,$2,$3)
    ON CONFLICT (privy_user_id)
    DO UPDATE SET email = EXCLUDED.email
    RETURNING id;
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
});

/* ===============================
   JWT Guard
================================ */
function requireBackendAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }
    req.userId = jwt.verify(
      auth.replace("Bearer ", ""),
      process.env.BACKEND_JWT_SECRET
    ).uid;
    next();
  } catch {
    res.status(401).json({ error: "Invalid backend token" });
  }
}

/* ===============================
   BUY
================================ */
app.post("/trade/buy", requireBackendAuth, async (req, res) => {
  const { market_id, outcome, shares, price } = req.body;
  const key = req.headers["idempotency-key"];

  if (!market_id || !outcome || !shares || !price || !key) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const cost = Number(shares) * Number(price);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const bal = await client.query(
      `SELECT balance FROM users WHERE id = $1 FOR UPDATE`,
      [req.userId]
    );

    if (Number(bal.rows[0].balance) < cost) {
      throw new Error("Insufficient balance");
    }

    await client.query(
      `
      INSERT INTO portfolios
      (user_id, market_id, outcome, shares, avg_price, idempotency_key)
      VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [req.userId, market_id, outcome, shares, price, key]
    );

    await client.query(
      `UPDATE users SET balance = balance - $1 WHERE id = $2`,
      [cost, req.userId]
    );

    await client.query("COMMIT");
    res.json({ spent: cost });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* ===============================
   Balance
================================ */
app.get("/portfolio/meta", requireBackendAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT balance FROM users WHERE id = $1`,
    [req.userId]
  );
  res.json({ balance: Number(rows[0].balance) });
});

/* ===============================
   Positions
================================ */
app.get("/portfolio/positions", requireBackendAuth, async (req, res) => {
  const { rows } = await pool.query(
    `
    SELECT market_id, outcome,
           SUM(shares) AS total_shares,
           AVG(avg_price) AS avg_price
    FROM portfolios
    WHERE user_id = $1
    GROUP BY market_id, outcome
    HAVING SUM(shares) <> 0
    `,
    [req.userId]
  );

  res.json({ positions: rows });
});

app.listen(PORT, () => {
  console.log("🚀 Backend running");
});