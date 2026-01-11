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
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
if (!process.env.BACKEND_JWT_SECRET) throw new Error("BACKEND_JWT_SECRET missing");
if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET)
  throw new Error("PRIVY env missing");

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
   Migration (FIX BALANCE)
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

  // 🔑 CRITICAL FIX: BACKFILL BALANCE
  await pool.query(`
    UPDATE users
    SET balance = 1000
    WHERE balance IS NULL OR balance = 0;
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

  console.log("✅ Migration complete");
}

await migrate();

/* ===============================
   Auth
================================ */
app.post("/auth/privy", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer "))
      return res.status(401).json({ error: "Missing auth" });

    const verified = await privy.verifyAuthToken(auth.replace("Bearer ", ""));

    const { rows } = await pool.query(
      `
      INSERT INTO users (privy_user_id, email, wallet_address)
      VALUES ($1, $2, $3)
      ON CONFLICT (privy_user_id)
      DO NOTHING
      RETURNING id;
      `,
      [verified.userId, verified.email ?? null, verified.wallet?.address ?? null]
    );

    const userId =
      rows[0]?.id ??
      (
        await pool.query(
          `SELECT id FROM users WHERE privy_user_id = $1`,
          [verified.userId]
        )
      ).rows[0].id;

    const token = jwt.sign(
      { uid: userId },
      process.env.BACKEND_JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Auth failed" });
  }
});

/* ===============================
   JWT Guard
================================ */
function requireBackendAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer "))
      return res.status(401).json({ error: "Missing auth" });

    req.userId = jwt.verify(
      auth.replace("Bearer ", ""),
      process.env.BACKEND_JWT_SECRET
    ).uid;

    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

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