import express from "express";
import cors from "cors";
import { PrivyClient } from "@privy-io/server-auth";
import pkg from "pg";
import jwt from "jsonwebtoken";

const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;

/* ===============================
   Middleware
================================ */
app.use(cors());
app.use(express.json());

/* ===============================
   ENV VALIDATION
================================ */
const {
  DATABASE_URL,
  PRIVY_APP_ID,
  PRIVY_APP_SECRET,
  BACKEND_JWT_SECRET,
} = process.env;

if (!DATABASE_URL) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
  console.error("PRIVY_APP_ID or PRIVY_APP_SECRET missing");
  process.exit(1);
}

if (!BACKEND_JWT_SECRET) {
  console.error("BACKEND_JWT_SECRET missing");
  process.exit(1);
}

/* ===============================
   Database
================================ */
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

/* ===============================
   Privy Client
================================ */
const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

/* ===============================
   DB Migration (SAFE)
================================ */
async function ensureUsersSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      privy_user_id TEXT UNIQUE NOT NULL,
      email TEXT,
      wallet_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

/* ===============================
   BACKEND JWT HELPERS
================================ */
function signBackendToken(user) {
  return jwt.sign(
    {
      uid: user.id,
      privy_user_id: user.privy_user_id,
    },
    BACKEND_JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function requireBackendAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing backend token" });
    }

    const token = auth.replace("Bearer ", "");
    const decoded = jwt.verify(token, BACKEND_JWT_SECRET);

    req.auth = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid backend token" });
  }
}

/* ===============================
   ROUTES
================================ */

/**
 * 🔐 Privy → Backend Session Exchange
 * Privy token is used ONLY here
 */
app.post("/auth/privy", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Privy token" });
    }

    const privyToken = auth.replace("Bearer ", "");

    const verified = await privy.verifyAccessToken(privyToken);

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

    const user = rows[0];
    const backendToken = signBackendToken(user);

    res.json({
      ok: true,
      token: backendToken,
    });
  } catch (err) {
    console.error("Privy auth failed:", err.message);
    res.status(401).json({ error: "Invalid Privy token" });
  }
});

/**
 * ✅ Canonical authenticated user
 * BACKEND TOKEN ONLY
 */
app.get("/me", requireBackendAuth, async (req, res) => {
  const { uid } = req.auth;

  const { rows } = await pool.query(
    "SELECT * FROM users WHERE id = $1",
    [uid]
  );

  res.json({ user: rows[0] });
});

app.get("/", (_, res) => {
  res.send("Predix backend running");
});

/* ===============================
   START SERVER
================================ */
(async () => {
  try {
    await ensureUsersSchema();
    app.listen(PORT, () => {
      console.log("Predix backend listening on", PORT);
    });
  } catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
  }
})();