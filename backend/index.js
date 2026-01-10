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
   Ensure Users Table
================================ */
async function ensureUsersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      privy_user_id TEXT UNIQUE NOT NULL,
      email TEXT,
      wallet_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log("✅ Users table ensured");
}

ensureUsersTable().catch((err) => {
  console.error("❌ Failed creating users table:", err);
  process.exit(1);
});

/* ===============================
   🔐 Privy Auth + DB User
================================ */
async function requirePrivyAuth(req, res, next) {
  console.log("➡️ Incoming authenticated request:", req.method, req.path);

  try {
    const authHeader = req.headers.authorization;
    console.log("🔑 Authorization header:", authHeader ? "PRESENT" : "MISSING");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ Missing or invalid Authorization header");
      return res.status(401).json({
        error: "Missing Authorization header",
      });
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("🔐 Token length:", token.length);

    // ✅ Verify with Privy
    const verified = await privy.verifyAuthToken(token);
    console.log("✅ Privy verified user:", verified.userId);

    const privyUserId = verified.userId;
    const email = verified.email ?? null;
    const wallet = verified.wallet?.address ?? null;

    console.log("💾 Upserting user in DB:", {
      privyUserId,
      email,
      wallet,
    });

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

    console.log("✅ DB user resolved:", rows[0].id);

    req.user = rows[0];
    next();
  } catch (err) {
    console.error("❌ Auth failed at requirePrivyAuth");
    console.error("❌ Reason:", err.message);
    return res.status(401).json({
      error: "Invalid Privy token",
    });
  }
}

/* ===============================
   Auth Diagnostic
================================ */
app.post("/auth/privy", requirePrivyAuth, (req, res) => {
  console.log("🧪 /auth/privy success");
  res.json({
    ok: true,
    user: req.user,
  });
});

/* ===============================
   ✅ Canonical User Endpoint
================================ */
app.get("/me", requirePrivyAuth, (req, res) => {
  console.log("👤 /me success for user:", req.user.id);
  res.json({
    user: req.user,
  });
});

/* ===============================
   Health Check
================================ */
app.get("/", (_, res) => {
  res.send("✅ Predix backend running");
});

/* ===============================
   Start Server
================================ */
app.listen(PORT, () => {
  console.log(`🚀 Predix backend listening on ${PORT}`);
});