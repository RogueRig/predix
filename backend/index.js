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
   Database Migration (SAFE)
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
      idempotency_key TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, idempotency_key)
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
    if (!auth?.startsWith("Bearer ")) {
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
  } catch (err) {
    console.error("Backend auth failed:", err);
    res.status(401).json({ error: "Backend auth failed" });
  }
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
   BUY TRADE (IDEMPOTENT & SAFE)
   POST /trade/buy
================================ */
app.post("/trade/buy", requireBackendAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const idempotencyKey = req.headers["idempotency-key"];
    if (!idempotencyKey) {
      return res.status(400).json({ error: "Missing Idempotency-Key header" });
    }

    const { market_id, outcome, shares, price } = req.body;

    if (!market_id || !outcome || !shares || !price) {
      return res.status(400).json({ error: "Invalid trade payload" });
    }

    const cost = Number(shares) * Number(price);

    await client.query("BEGIN");

    // 🔒 Lock user row
    const userRes = await client.query(
      `SELECT balance FROM users WHERE id = $1 FOR UPDATE`,
      [req.userId]
    );

    if (userRes.rows.length === 0) {
      throw new Error("User not found");
    }

    const balance = Number(userRes.rows[0].balance);

    if (balance < cost) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // ✅ Idempotency check
    const existing = await client.query(
      `
      SELECT id FROM portfolios
      WHERE user_id = $1 AND idempotency_key = $2
      `,
      [req.userId, idempotencyKey]
    );

    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.json({ status: "duplicate_ignored" });
    }

    // Insert portfolio
    await client.query(
      `
      INSERT INTO portfolios
      (user_id, market_id, outcome, shares, avg_price, idempotency_key)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [req.userId, market_id, outcome, shares, price, idempotencyKey]
    );

    // Update balance
    await client.query(
      `
      UPDATE users
      SET balance = balance - $1
      WHERE id = $2
      `,
      [cost, req.userId]
    );

    await client.query("COMMIT");

    res.json({
      status: "filled",
      spent: cost,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Buy failed:", err);
    res.status(500).json({ error: "Trade failed" });
  } finally {
    client.release();
  }
});

/* ===============================
   Portfolio
================================ */
app.get("/portfolio", requireBackendAuth, async (req, res) => {
  const { rows } = await pool.query(
    `
    SELECT market_id, outcome, shares, avg_price, created_at
    FROM portfolios
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [req.userId]
  );

  res.json({ portfolio: rows });
});

/* ===============================
   Balance
================================ */
app.get("/portfolio/meta", requireBackendAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT balance FROM users WHERE id = $1`,
    [req.userId]
  );

  res.json({ balance: rows[0].balance });
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