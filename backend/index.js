import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { PrivyClient } from "@privy-io/server-auth";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 10000;
const STARTING_BALANCE = 1000;

/* ===============================
   Middleware
================================ */
app.use(cors());
app.use(express.json());

/* ===============================
   ENV CHECK
================================ */
for (const v of [
  "DATABASE_URL",
  "BACKEND_JWT_SECRET",
  "PRIVY_APP_ID",
  "PRIVY_APP_SECRET",
]) {
  if (!process.env[v]) {
    console.error(`${v} missing`);
    process.exit(1);
  }
}

/* ===============================
   Database
================================ */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/* ===============================
   Privy
================================ */
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

/* ===============================
   Migration
================================ */
async function migrate() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      privy_user_id TEXT UNIQUE NOT NULL,
      email TEXT,
      wallet_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS portfolios (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      market_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      shares NUMERIC NOT NULL,
      avg_price NUMERIC NOT NULL,
      idempotency_key TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log("✅ Database ready");
}

await migrate();

/* ===============================
   Helpers
================================ */
function getMarketPrice(marketId, outcome) {
  if (outcome === "YES") return 0.62;
  if (outcome === "NO") return 0.38;
  return 0;
}

/* ===============================
   Auth
================================ */
app.post("/auth/privy", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }

  const verified = await privy.verifyAuthToken(auth.replace("Bearer ", ""));

  const { rows } = await pool.query(
    `
    INSERT INTO users (privy_user_id, email, wallet_address)
    VALUES ($1,$2,$3)
    ON CONFLICT (privy_user_id)
    DO UPDATE SET email = EXCLUDED.email
    RETURNING id;
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
});

/* ===============================
   Auth Guard
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
   Trade (Buy / Sell)
================================ */
app.post("/trade", requireBackendAuth, async (req, res) => {
  const { market_id, outcome, shares, price } = req.body;
  const key = req.headers["idempotency-key"];

  if (!market_id || !outcome || !shares || !price || !key) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  await pool.query(
    `
    INSERT INTO portfolios
    (user_id, market_id, outcome, shares, avg_price, idempotency_key)
    VALUES ($1,$2,$3,$4,$5,$6)
    `,
    [req.userId, market_id, outcome, Number(shares), Number(price), key]
  );

  res.json({ ok: true });
});

/* ===============================
   Portfolio (Balance + Positions + PnL)
================================ */
app.get("/portfolio", requireBackendAuth, async (req, res) => {
  const { rows } = await pool.query(
    `
    SELECT
      market_id,
      outcome,
      SUM(shares) AS total_shares,
      SUM(CASE WHEN shares > 0 THEN shares * avg_price ELSE 0 END) AS buy_cost,
      SUM(CASE WHEN shares < 0 THEN ABS(shares * avg_price) ELSE 0 END) AS sell_proceeds
    FROM portfolios
    WHERE user_id = $1
    GROUP BY market_id, outcome
    HAVING SUM(shares) <> 0;
    `,
    [req.userId]
  );

  let balance = STARTING_BALANCE;
  const positions = [];

  for (const r of rows) {
    balance -= Number(r.buy_cost);
    balance += Number(r.sell_proceeds);

    const netShares = Number(r.total_shares);
    const avgPrice =
      netShares !== 0 ? Number(r.buy_cost) / Math.abs(netShares) : 0;

    const currentPrice = getMarketPrice(r.market_id, r.outcome);
    const positionValue = netShares * currentPrice;
    const unrealizedPnl = positionValue - (netShares * avgPrice);

    positions.push({
      market_id: r.market_id,
      outcome: r.outcome,
      shares: netShares,
      avg_price: avgPrice,
      current_price: currentPrice,
      position_value: positionValue,
      unrealized_pnl: unrealizedPnl,
    });
  }

  res.json({
    balance,
    positions,
  });
});

/* ===============================
   Health
================================ */
app.get("/", (_, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log("🚀 Backend running");
});