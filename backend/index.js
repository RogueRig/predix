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
  console.error("DATABASE_URL missing");
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
  console.error("PRIVY_APP_ID or PRIVY_APP_SECRET missing");
  process.exit(1);
}

const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);

/* ===============================
   DB Migration (BLOCKING)
================================ */
async function ensureUsersSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  async function ensureColumn(name, sql) {
    const { rows } = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = $1;
      `,
      [name]
    );

    if (rows.length === 0) {
      console.log("Adding missing column:", name);
      await pool.query("ALTER TABLE users ADD COLUMN " + sql + ";");
      console.log("Column added:", name);
    }
  }

  await ensureColumn("privy_user_id", "privy_user_id TEXT");
  await ensureColumn("email", "email TEXT");
  await ensureColumn("wallet_address", "wallet_address TEXT");

  await pool.query(`
    ALTER TABLE users
    ALTER COLUMN privy_user_id SET NOT NULL;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_privy_user_id_idx
    ON users (privy_user_id);
  `);

  console.log("Users schema ensured");
}

/* ===============================
   Privy Auth + DB User
================================ */
async function requirePrivyAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");

    // IMPORTANT: frontend token verification
    const verified = await privy.verifyAccessToken(token);

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
    console.error("Auth failed:", err.message);
    res.status(401).json({ error: "Invalid Privy token" });
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
  res.send("Predix backend running");
});

/* ===============================
   START SERVER AFTER MIGRATION
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