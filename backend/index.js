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
   SAFE MIGRATION (NO DATA LOSS)
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE portfolios
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'portfolios_user_id_idempotency_key_key'
      ) THEN
        ALTER TABLE portfolios
        ADD CONSTRAINT portfolios_user_id_idempotency_key_key
        UNIQUE (user_id, idempotency_key);
      END IF;
    END$$;
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
  } catch (e) {
    console.error(e);
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
   BUY TRADE
================================ */
app.post("/trade/buy", requireBackendAuth, async (req, res) => {
  const client = await pool.connect();

  try {
    const key = req.headers["idempotency-key"];
    if (typeof key !== "string") {
      return res.status(400).json({ error: "Missing Idempotency-Key" });
    }

    const { market_id, outcome, shares, price } = req.body;
    if (!market_id || !outcome || !shares || !price) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const cost = Number(shares) * Number(price);

    await client.query("BEGIN");

    const balRes = await client.query(
      `SELECT balance FROM users WHERE id = $1 FOR UPDATE`,
      [req.userId]
    );

    const balance = Number(balRes.rows[0].balance);

    if (balance < cost) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient balance" });
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

    res.json({
      status: "filled",
      spent: cost,
      remaining_balance: balance - cost,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* ===============================
   Portfolio Balance
================================ */
app.get("/portfolio/meta", requireBackendAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT balance FROM users WHERE id = $1`,
    [req.userId]
  );
  res.json({ balance: Number(rows[0]?.balance ?? 0) });
});

/* ===============================
   🔥 NEW: POSITIONS (AGGREGATED)
================================ */
app.get("/portfolio/positions", requireBackendAuth, async (req, res) => {
  const { rows } = await pool.query(
    `
    SELECT
      market_id,
      outcome,
      SUM(shares) AS total_shares,
      ROUND(
        SUM(shares * avg_price) / NULLIF(SUM(shares), 0),
        4
      ) AS avg_price
    FROM portfolios
    WHERE user_id = $1
    GROUP BY market_id, outcome
    HAVING SUM(shares) <> 0
    ORDER BY market_id, outcome;
    `,
    [req.userId]
  );

  res.json({ positions: rows });
});

/* ===============================
   Health
================================ */
app.get("/", (_, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log("🚀 Backend running");
});