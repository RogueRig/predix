import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { PrivyClient } from "@privy-io/server-auth";
import pkg from "pg";
import fetch from "node-fetch";

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
   Database Migration
================================ */
async function migrate() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID,
      privy_user_id TEXT UNIQUE,
      email TEXT,
      wallet_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    UPDATE users
    SET id = gen_random_uuid()
    WHERE id IS NULL;
  `);

  await pool.query(`
    ALTER TABLE users
    ALTER COLUMN id SET DEFAULT gen_random_uuid(),
    ALTER COLUMN id SET NOT NULL,
    ALTER COLUMN privy_user_id SET NOT NULL;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey'
      ) THEN
        ALTER TABLE users ADD PRIMARY KEY (id);
      END IF;
    END$$;
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

    const token = jwt.sign(
      { uid: rows[0].id },
      process.env.BACKEND_JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    console.error("Backend auth failed:", err);
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
   Portfolio
================================ */
app.get("/portfolio", requireBackendAuth, async (req, res) => {
  const { rows } = await pool.query(
    `
    SELECT id, market_id, outcome, shares, avg_price, created_at
    FROM portfolios
    WHERE user_id = $1
    ORDER BY created_at DESC;
    `,
    [req.userId]
  );
  res.json({ portfolio: rows });
});

/* ===============================
   🌐 Polymarket TOP MARKETS
   (Discovery ONLY — Option C locked)
================================ */
app.get("/polymarket/top", async (_req, res) => {
  try {
    // 1️⃣ Fetch top markets by volume (Gamma)
    const gammaRes = await fetch(
      "https://gamma-api.polymarket.com/markets?order=volume&direction=desc&limit=20"
    );

    if (!gammaRes.ok) {
      return res.status(502).json({ error: "Gamma unavailable" });
    }

    const gammaJson = await gammaRes.json();
    const marketsRaw = gammaJson?.data ?? [];

    const markets = [];

    // 2️⃣ Enrich with live prices from CLOB
    for (const m of marketsRaw) {
      const clobRes = await fetch(
        `https://clob.polymarket.com/markets/${m.id}`
      );

      if (!clobRes.ok) continue;

      const clob = await clobRes.json();

      markets.push({
        market_id: m.id,
        question: m.question || m.title || null,
        endDate: m.endDate,
        volume: m.volume || 0,
        outcomes: clob.outcomes?.map((o) => ({
          name: o.name,
          price: o.price,
        })),
      });
    }

    res.json({
      markets,
      asOf: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Polymarket top failed:", err);
    res.status(500).json({ error: "Polymarket top failed" });
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

/* ===============================
   🔎 DEBUG: Gamma Events Snapshot
   GET /debug/gamma-events
================================ */
app.get("/debug/gamma-events", async (_req, res) => {
  try {
    const r = await fetch(
      "https://gamma-api.polymarket.com/events?order=volume&direction=desc&limit=5"
    );

    if (!r.ok) {
      return res.status(502).json({ error: "Gamma unavailable" });
    }

    const j = await r.json();

    res.json({
      count: j?.data?.length || 0,
      sample: j?.data?.slice(0, 5) || [],
    });
  } catch (err) {
    console.error("Gamma debug failed:", err);
    res.status(500).json({ error: "Gamma debug failed" });
  }
});