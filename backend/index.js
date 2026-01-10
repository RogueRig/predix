import express from "express";
import cors from "cors";
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
   Database
================================ */
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

/* ===============================
   Privy Server Client
================================ */
const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
  console.error("❌ PRIVY_APP_ID or PRIVY_APP_SECRET missing");
  process.exit(1);
}

const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

/* ===============================
   🔧 DB Migration (SAFE)
================================ */
async function ensureUsersSchema() {
  // 1️⃣ Ensure table exists (legacy-safe)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT,
      wallet_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // 2️⃣ Add privy_user_id column if missing
  const { rows } = await pool.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'privy_user_id';
  `);

  if (rows.length === 0) {
    console.log("🛠 Adding missing privy_user_id column");

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN privy_user_id TEXT;
    `);

    await pool.query(`
      UPDATE users
      SET privy_user_id = id::text
      WHERE privy_user_id IS NULL;
    `);

    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN privy_user_id SET NOT NULL;
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_privy_user_id_idx
      ON users (privy_user_id);
    `);

    console.log("✅ privy_user_id column added safely");
  } else {
    console.log("✅ privy_user_id column already exists");
  }
}

ensureUsersSchema().catch((err) => {
  console.error("❌ Failed DB migration:", err);
  process.exit(1);
});

/* ===============================
   🔐 Privy Auth + DB User
================================ */
async function requirePrivyAuth(req, res, next) {
  console.log("➡️ Incoming authenticated request:", req.method, req.path);

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");

    const verified = await privy.verifyAuthToken(token);

    const privyUserId = verified.userId;
    const email = verified.email ?? null;
    const wallet = verified.wallet?.address ?? null;

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
      [privyUserId, email, wallet]
    );

    req.user = rows[0];
    next();
  } catch (err) {
    console.error("❌ Auth failed:", err.message);
    return res.status(401).json({ error: "Invalid Privy token" });
  }
}

/* ===============================
   Routes
================================ */
app.post("/auth/privy", requirePrivyAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.get("/me", requirePrivyAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/", (_, res) => {
  res.send("✅ Predix backend running");
});

/* ===============================
   Start Server
================================ */
app.listen(PORT, () => {
  console.log(`🚀 Predix backend listening on ${PORT}`);
});