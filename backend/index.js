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
   CORS — MUST BE FIRST
================================ */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  })
);

// 🔴 CRITICAL: short-circuit OPTIONS
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

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
   Migration (SAFE)
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
      outcome TEXT NOT NULL,
      side TEXT CHECK (side IN ('buy','sell')),
      shares NUMERIC NOT NULL,
      price NUMERIC NOT NULL,
      realized_pnl NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  console.log("✅ Database ready");
}

await migrate();

/* ===============================
   Helpers
================================ */
function getMarketPrice(marketId: string, outcome: string): number {
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
   Trade (BUY / SELL)
================================ */
app.post("/trade", requireBackendAuth, async (req, res) => {
  const { market_id, outcome, side, shares, price } = req.body;

  if (!market_id || !outcome || !side || !shares || !price) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const posRes = await client.query(
      `
      SELECT shares, avg_price
      FROM positions
      WHERE user_id = $1 AND market_id = $2 AND outcome = $3
      FOR UPDATE
      `,
      [req.userId, market_id, outcome]
    );

    let realizedPnl = 0;

    if (side === "buy") {
      if (posRes.rows.length === 0) {
        await client.query(
          `
          INSERT INTO positions
          (user_id, market_id, outcome, shares, avg_price)
          VALUES ($1,$2,$3,$4,$5)
          `,
          [req.userId, market_id, outcome, shares, price]
        );
      } else {
        const cur = posRes.rows[0];
        const newShares = Number(cur.shares) + Number(shares);
        const newAvg =
          (Number(cur.shares) * Number(cur.avg_price) +
            Number(shares) * Number(price)) /
          newShares;

        await client.query(
          `
          UPDATE positions
          SET shares = $1, avg_price = $2
          WHERE user_id = $3 AND market_id = $4 AND outcome = $5
          `,
          [newShares, newAvg, req.userId, market_id, outcome]
        );
      }
    }

    if (side === "sell") {
      if (posRes.rows.length === 0 || Number(posRes.rows[0].shares) < shares) {
        throw new Error("Insufficient shares");
      }

      const cur = posRes.rows[0];
      realizedPnl =
        (Number(price) - Number(cur.avg_price)) * Number(shares);

      const remaining = Number(cur.shares) - Number(shares);

      if (remaining === 0) {
        await client.query(
          `
          DELETE FROM positions
          WHERE user_id = $1 AND market_id = $2 AND outcome = $3
          `,
          [req.userId, market_id, outcome]
        );
      } else {
        await client.query(
          `
          UPDATE positions
          SET shares = $1
          WHERE user_id = $2 AND market_id = $3 AND outcome = $4
          `,
          [remaining, req.userId, market_id, outcome]
        );
      }

      await client.query(
        `
        UPDATE users
        SET realized_pnl = realized_pnl + $1
        WHERE id = $2
        `,
        [realizedPnl, req.userId]
      );
    }

    await client.query(
      `
      INSERT INTO trades
      (user_id, market_id, outcome, side, shares, price, realized_pnl)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [req.userId, market_id, outcome, side, shares, price, realizedPnl]
    );

    await client.query("COMMIT");

    res.json({ ok: true, realized_pnl: realizedPnl });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* ===============================
   PORTFOLIO
================================ */
app.get("/portfolio", requireBackendAuth, async (req, res) => {
  const posRes = await pool.query(
    `
    SELECT market_id, outcome, shares, avg_price
    FROM positions
    WHERE user_id = $1
    `,
    [req.userId]
  );

  const userRes = await pool.query(
    `SELECT realized_pnl FROM users WHERE id = $1`,
    [req.userId]
  );

  let unrealizedPnl = 0;
  let invested = 0;

  const positions = posRes.rows.map((p) => {
    const price = getMarketPrice(p.market_id, p.outcome);
    const value = Number(p.shares) * price;
    const cost = Number(p.shares) * Number(p.avg_price);
    const u = value - cost;

    invested += cost;
    unrealizedPnl += u;

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

  const realizedPnl = Number(userRes.rows[0]?.realized_pnl ?? 0);
  const balance = STARTING_BALANCE + realizedPnl - invested;

  res.json({
    balance,
    realized_pnl: realizedPnl,
    unrealized_pnl: unrealizedPnl,
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