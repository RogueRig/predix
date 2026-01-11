import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { PrivyClient } from "@privy-io/server-auth";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
if (!process.env.BACKEND_JWT_SECRET) throw new Error("BACKEND_JWT_SECRET missing");
if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET)
  throw new Error("PRIVY_APP env missing");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

/* ===============================
   MIGRATION
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

  console.log("✅ Migration done");
}
await migrate();

/* ===============================
   AUTH
================================ */
app.post("/auth/privy", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const verified = await privy.verifyAuthToken(auth.replace("Bearer ", ""));

    const { rows } = await pool.query(
      `
      INSERT INTO users (privy_user_id, email, wallet_address)
      VALUES ($1, $2, $3)
      ON CONFLICT (privy_user_id)
      DO UPDATE SET email = EXCLUDED.email,
                    wallet_address = EXCLUDED.wallet_address
      RETURNING id;
      `,
      [verified.userId, verified.email ?? null, verified.wallet?.address ?? null]
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
   JWT GUARD (DEBUGGED)
================================ */
function requireBackendAuth(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth) {
    return res.status(401).json({
      error: "Missing auth",
      received_headers: Object.keys(req.headers),
    });
  }

  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Malformed auth header",
      auth_value: auth,
    });
  }

  try {
    const decoded = jwt.verify(
      auth.replace("Bearer ", ""),
      process.env.BACKEND_JWT_SECRET
    );
    req.userId = decoded.uid;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* ===============================
   BUY
================================ */
app.post("/trade/buy", requireBackendAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const key = req.headers["idempotency-key"];
    if (!key) return res.status(400).json({ error: "Missing Idempotency-Key" });

    const { market_id, outcome, shares, price } = req.body;
    if (!market_id || !outcome || !shares || !price) {
      return res.status(400).json({ error: "Invalid payload", body: req.body });
    }

    const cost = Number(shares) * Number(price);

    await client.query("BEGIN");

    const bal = await client.query(
      `SELECT balance FROM users WHERE id = $1 FOR UPDATE`,
      [req.userId]
    );

    if (Number(bal.rows[0].balance) < cost) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient balance" });
    }

    await client.query(
      `
      INSERT INTO portfolios
      (user_id, market_id, outcome, shares, avg_price, idempotency_key)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [req.userId, market_id, outcome, shares, price, key]
    );

    await client.query(
      `UPDATE users SET balance = balance - $1 WHERE id = $2`,
      [cost, req.userId]
    );

    await client.query("COMMIT");
    res.json({ status: "filled", spent: cost });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    res.status(500).json({ error: "Trade failed" });
  } finally {
    client.release();
  }
});

/* ===============================
   META
================================ */
app.get("/portfolio/meta", requireBackendAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT balance FROM users WHERE id = $1`,
    [req.userId]
  );
  res.json({ balance: rows[0].balance });
});

app.get("/", (_, res) => res.send("Predix backend running"));

app.listen(PORT, () => {
  console.log("🚀 Backend running on", PORT);
});