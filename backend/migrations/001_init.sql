
-- Users (Privy-compatible)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Prediction markets
CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Paper trades
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  market_id UUID REFERENCES markets(id),
  side TEXT CHECK (side IN ('YES', 'NO')),
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);