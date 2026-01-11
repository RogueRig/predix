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

/* ===============================
   ENV CHECK
================================ */
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
if (!process.env.BACKEND_JWT_SECRET) throw new Error("BACKEND_JWT_SECRET missing");
if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET)
  throw new Error("PRIVY env missing");

/* ===============================
   DB
================================ */
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
    user_id UUID NOT NULL REFERENCES users(id),
    market_id TEXT NOT NULL,
    outcome TEXT NOT NULL,
    shares NUMERIC NOT NULL,
    avg_price NUMERIC NOT NULL,
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, idempotency_key)
  );
`);

/* ===============================
   AUTH
================================ */
app.post("/auth/privy", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer "))
    return res.status(401).json({ error: "Missing auth" });

  const verified = await privy.verifyAuthToken(auth.replace("Bearer ", ""));

  const { rows } = await pool.query(
    `
    INSERT INTO users (privy_user_id, email, wallet_address)
    VALUES ($1,$2,$3)
    ON CONFLICT (privy_user_id)
    DO UPDATE SET email = EXCLUDED.email
    RETURNING id, privy_user_id, balance;
    `,
    [verified.userId, verified.email ?? null, verified.wallet?.address ?? null]
  );

  const token = jwt.sign(
    { uid: rows[0].id },
    process.env.BACKEND_JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token, user: rows[0] });
});

/* ===============================
   JWT
================================ */
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer "))
    return res.status(401).json({ error: "Missing auth" });

  try {
    const decoded = jwt.verify(
      auth.replace("Bearer ", ""),
      process.env.BACKEND_JWT_SECRET
    );
    req.userId = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: "Bad token" });
  }
}

/* ===============================
   🔍 DEBUG (THIS IS KEY)
================================ */
app.get("/debug/me", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, privy_user_id, balance FROM users WHERE id = $1`,
    [req.userId]
  );

  res.json({
    token_uid: req.userId,
    user_row_exists: rows.length > 0,
    user: rows[0] ?? null,
  });
});

/* ===============================
   BUY
================================ */
app.post("/trade/buy", requireAuth, async (req, res) => {
  res.json({
    error: "TEMPORARILY DISABLED",
    reason: "Run /debug/me first",
  });
});

/* ===============================
   META
================================ */
app.get("/portfolio/meta", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT balance FROM users WHERE id = $1`,
    [req.userId]
  );
  res.json({ balance: rows[0]?.balance ?? 0 });
});

app.get("/", (_, res) => res.send("OK"));

app.listen(PORT, () => {
  console.log("Backend running");
});