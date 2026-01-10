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
   DB MIGRATION (FIX UUID ISSUE)
================================ */
async function migrate() {
  // 1️⃣ Enable UUID support
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  // 2️⃣ Create users table correctly
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      privy_user_id TEXT UNIQUE NOT NULL,
      email TEXT,
      wallet_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log("✅ Database schema verified");
}

await migrate();

/* ===============================
   🔐 Privy → Backend Exchange
================================ */
app.post("/auth/privy", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const privyToken = auth.replace("Bearer ", "");

    // ✅ Correct verification
    const verified = await privy.verifyAuthToken(privyToken);

    // ✅ Upsert user (UUID now auto-generates correctly)
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

    const user = rows[0];

    // ✅ Issue backend JWT
    const backendToken = jwt.sign(
      { uid: user.id },
      process.env.BACKEND_JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token: backendToken,
      user: {
        id: user.id,
        email: user.email,
        wallet: user.wallet_address,
      },
    });
  } catch (err) {
    console.error("❌ Backend auth failed:", err);
    res.status(401).json({ error: "Backend auth failed" });
  }
});

/* ===============================
   🔒 Backend JWT Guard
================================ */
function requireBackendAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const token = auth.replace("Bearer ", "");
    const payload = jwt.verify(token, process.env.BACKEND_JWT_SECRET);

    req.userId = payload.uid;
    next();
  } catch {
    res.status(401).json({ error: "Invalid backend token" });
  }
}

/* ===============================
   /me
================================ */
app.get("/me", requireBackendAuth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, email, wallet_address FROM users WHERE id = $1",
    [req.userId]
  );

  res.json({ user: rows[0] });
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