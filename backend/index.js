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
   Privy Implementation
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
   🌐 Polymarket SEARCH (READ-ONLY)
   GET /polymarket/search?q=...
================================ */
app.get("/polymarket/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: "Missing query param q" });
    }

    const r = await fetch(
      `https://gamma-api.polymarket.com/events?search=${encodeURIComponent(
        q
      )}`
    );

    const j = await r.json();
    const events = j?.data ?? [];

    res.json({
      results: events.map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        endDate: e.endDate,
        resolved: e.resolved,
        markets: e.markets?.map((m) => ({
          id: m.id,
          outcomes: m.outcomes,
        })),
      })),
    });
  } catch (err) {
    console.error("Polymarket search failed:", err);
    res.status(500).json({ error: "Polymarket search failed" });
  }
});

/* ===============================
   🌐 Polymarket RESOLVE BY URL
   POST /polymarket/resolve-url
   { "url": "https://polymarket.com/event/..." }
================================ */
app.post("/polymarket/resolve-url", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !url.includes("/event/")) {
      return res.status(400).json({ error: "Invalid Polymarket URL" });
    }

    const slug = url.split("/event/")[1]?.split("?")[0];
    if (!slug) {
      return res.status(400).json({ error: "Could not extract slug" });
    }

    const eventRes = await fetch(
      `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(
        slug
      )}`
    );

    const eventJson = await eventRes.json();
    const event = eventJson?.data?.[0];

    if (!event || !event.markets?.length) {
      return res.status(404).json({ error: "Event not found" });
    }

    const marketId = event.markets[0].id;

    const marketRes = await fetch(
      `https://clob.polymarket.com/markets/${marketId}`
    );

    if (!marketRes.ok) {
      return res.status(404).json({ error: "Market not found" });
    }

    const market = await marketRes.json();

    res.json({
      slug,
      event_id: event.id,
      question: event.title,
      endDate: event.endDate,
      market_id: marketId,
      outcomes: market.outcomes?.map((o) => ({
        name: o.name,
        price: o.price,
      })),
    });
  } catch (err) {
    console.error("Resolve URL failed:", err);
    res.status(500).json({ error: "Resolve URL failed" });
  }
});

/* ===============================
   🌐 Polymarket VALIDATE (LOCKED)
================================ */
app.post("/polymarket/validate", async (req, res) => {
  try {
    const { marketId } = req.body;

    if (!marketId) {
      return res.status(400).json({ error: "marketId is required" });
    }

    const marketRes = await fetch(
      `https://clob.polymarket.com/markets/${marketId}`
    );

    if (!marketRes.ok) {
      return res.status(404).json({ error: "Market not found" });
    }

    const market = await marketRes.json();

    res.json({
      market_id: market.id,
      question: market.question,
      resolved: market.resolved,
      outcomes: market.outcomes?.map((o) => ({
        name: o.name,
        price: o.price,
      })),
    });
  } catch (err) {
    console.error("Polymarket validate failed:", err);
    res.status(500).json({ error: "Polymarket validate failed" });
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