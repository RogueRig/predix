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
console.log("🔐 PRIVY_APP_ID:", process.env.PRIVY_APP_ID);

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
   Privy Client
================================ */
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

/* ===============================
   DB Migration
================================ */
await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    privy_user_id TEXT UNIQUE NOT NULL,
    email TEXT,
    wallet_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`);

/* ===============================
   🔐 Privy → Backend Exchange (DEBUG)
================================ */
app.post("/auth/privy", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    console.log("➡️ /auth/privy called");

    if (!auth || !auth.startsWith("Bearer ")) {
      console.error("❌ Missing Authorization header");
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const privyToken = auth.replace("Bearer ", "");

    console.log("🔑 Token length:", privyToken.length);
    console.log("🔑 Token prefix:", privyToken.slice(0, 20));

    let verified;
    try {
      verified = await privy.verifyAuthToken(privyToken);
    } catch (e) {
      console.error("❌ Privy verifyAuthToken failed");
      console.error(e);
      throw e;
    }

    console.log("✅ Privy verified:", verified);

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

    const backendToken = jwt.sign(
      { uid: user.id },
      process.env.BACKEND_JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token: backendToken,
      user,
    });
  } catch (err) {
    console.error("🔥 BACKEND AUTH FAILED");
    console.error(err);
    return res.status(401).json({ error: "Backend auth failed" });
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