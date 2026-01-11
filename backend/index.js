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
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  })
);
app.options("*", cors());
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
   MIGRATION (BULLETPROOF)
================================ */
async function migrate() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      privy_user_id TEXT UNIQUE NOT NULL,
      email TEXT,
      wallet_address TEXT,
      realized_pnl NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS positions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      market_id TEXT NOT NULL,
      outcome TEXT NOT NULL,
      shares NUMERIC NOT NULL,
      avg_price NUMERIC NOT NULL,
      UNIQUE (user_id, market_id, outcome)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS trades (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      market_id TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  /* 🔧 PATCH ALL LEGACY SCHEMA DRIFT */
  await pool.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS outcome TEXT;`);
  await pool.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS side TEXT;`);
  await pool.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS shares NUMERIC;`);
  await pool.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS price NUMERIC;`);
  await pool.query(
    `ALTER TABLE trades ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC NOT NULL DEFAULT 0;`
  );

  await pool.query(
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC NOT NULL DEFAULT 0;`
  );

  console.log("✅ Database schema fully aligned");
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
   Trade
================================ */
app.post("/trade", requireBackendAuth, async (req, res) => {
  const { market_id, outcome, shares, price } = req.body;
  const side = shares > 0 ? "buy" : "sell";
  const qty = Math.abs(Number(shares));

  if (!market_id || !outcome || !qty || !price) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const posRes = await client.query(
      `
      SELECT shares, avg_price
      FROM positions
      WHERE user_id=$1 AND market_id=$2 AND outcome=$3
      FOR UPDATE
      `,
      [req.userId, market_id, outcome]
    );

    let realizedPnl = 0;

    if (side === "buy") {
      if (posRes.rows.length === 0) {
        await client.query(
          `
          INSERT INTO positions (user_id, market_id, outcome, shares, avg_price)
          VALUES ($1,$2,$3,$4,$5)
          `,
          [req.userId, market_id, outcome, qty, price]
        );
      } else {
        const cur = posRes.rows[0];
        const newShares = Number(cur.shares) + qty;
        const newAvg =
          (Number(cur.shares) * Number(cur.avg_price) + qty * price) /
          newShares;

        await client.query(
          `
          UPDATE positions
          SET shares=$1, avg_price=$2
          WHERE user_id=$3 AND market_id=$4 AND outcome=$5
          `,
          [newShares, newAvg, req.userId, market_id, outcome]
        );
      }
    } else {
      if (posRes.rows.length === 0 || Number(posRes.rows[0].shares) < qty) {
        throw new Error("Insufficient shares");
      }

      const cur = posRes.rows[0];
      realizedPnl = (price - cur.avg_price) * qty;

      const remaining = Number(cur.shares) - qty;

      if (remaining === 0) {
        await client.query(
          `DELETE FROM positions WHERE user_id=$1 AND market_id=$2 AND outcome=$3`,
          [req.userId, market_id, outcome]
        );
      } else {
        await client.query(
          `
          UPDATE positions SET shares=$1
          WHERE user_id=$2 AND market_id=$3 AND outcome=$4
          `,
          [remaining, req.userId, market_id, outcome]
        );
      }

      await client.query(
        `UPDATE users SET realized_pnl = realized_pnl + $1 WHERE id=$2`,
        [realizedPnl, req.userId]
      );
    }

    await client.query(
      `
      INSERT INTO trades
      (user_id, market_id, outcome, side, shares, price, realized_pnl)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [req.userId, market_id, outcome, side, qty, price, realizedPnl]
    );

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* ===============================
   Portfolio
================================ */
app.get("/portfolio", requireBackendAuth, async (req, res) => {
  const posRes = await pool.query(
    `SELECT market_id, outcome, shares, avg_price FROM positions WHERE user_id=$1`,
    [req.userId]
  );

  const userRes = await pool.query(
    `SELECT realized_pnl FROM users WHERE id=$1`,
    [req.userId]
  );

  let unrealized = 0;
  let invested = 0;

  const positions = posRes.rows.map((p) => {
    const price = getMarketPrice(p.market_id, p.outcome);
    const value = p.shares * price;
    const cost = p.shares * p.avg_price;
    const u = value - cost;

    invested += cost;
    unrealized += u;

    return {
      market_id: p.market_id,
      outcome: p.outcome,
      shares: Number(p.shares),
      avg_price: Number(p.avg_price),
      current_price: price,
      position_value: value,
      unrealized_pnl: u,
    };
  });

  const realized = Number(userRes.rows[0]?.realized_pnl ?? 0);
  const balance = STARTING_BALANCE + realized - invested;

  res.json({
    balance,
    realized_pnl: realized,
    unrealized_pnl: unrealized,
    positions,
  });
});

/* ===============================
   Health
================================ */
app.get("/", (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log("🚀 Backend running"));