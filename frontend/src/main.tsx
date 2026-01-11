import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

/* ===============================
   Auth Guard
================================ */
function Protected({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  if (!ready) return <p style={{ padding: 20 }}>Loading…</p>;
  return authenticated ? <>{children}</> : <Navigate to="/" replace />;
}

/* ===============================
   Login
================================ */
function Login() {
  const { login, ready, authenticated } = usePrivy();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (ready && authenticated) {
      navigate("/portfolio", { replace: true });
    }
  }, [ready, authenticated, navigate]);

  if (!ready) return <p style={{ padding: 20 }}>Loading…</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Predix</h1>
      <button onClick={login}>Login with Privy</button>
    </div>
  );
}

/* ===============================
   Portfolio
================================ */
function Portfolio() {
  const { getAccessToken, logout } = usePrivy();

  const [balance, setBalance] = React.useState(0);
  const [realizedPnL, setRealizedPnL] = React.useState(0);
  const [unrealizedPnL, setUnrealizedPnL] = React.useState(0);
  const [positions, setPositions] = React.useState<any[]>([]);
  const [trades, setTrades] = React.useState<any[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [marketId, setMarketId] = React.useState("test-market");
  const [outcome, setOutcome] = React.useState("YES");
  const [shares, setShares] = React.useState(1);
  const [price, setPrice] = React.useState(1);

  /* ===============================
     Backend Token (STRICT)
  ================================ */
  async function getBackendToken(): Promise<string> {
    const cached = localStorage.getItem("backend_token");
    if (typeof cached === "string") return cached;

    let privyToken: string | null = null;
    for (let i = 0; i < 10; i++) {
      const t = await getAccessToken();
      if (typeof t === "string") {
        privyToken = t;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!privyToken) throw new Error("Privy token unavailable");

    const res = await fetch(
      "https://predix-backend.onrender.com/auth/privy",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${privyToken}` },
      }
    );

    const json = await res.json();
    if (!res.ok || typeof json.token !== "string") {
      throw new Error("Backend auth failed");
    }

    localStorage.setItem("backend_token", json.token);
    return json.token;
  }

  /* ===============================
     Portfolio
  ================================ */
  async function refreshPortfolio() {
    const token = await getBackendToken();

    const res = await fetch(
      "https://predix-backend.onrender.com/portfolio",
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Portfolio failed");

    setBalance(Number(json.balance ?? 0));
    setRealizedPnL(Number(json.realized_pnl ?? 0));
    setUnrealizedPnL(Number(json.unrealized_pnl ?? 0));
    setPositions(json.positions ?? []);
  }

  /* ===============================
     Trade History
  ================================ */
  async function refreshTrades() {
    const token = await getBackendToken();

    const res = await fetch(
      "https://predix-backend.onrender.com/trades",
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Trades failed");

    setTrades(json.trades ?? []);
  }

  /* ===============================
     Initial Load
  ================================ */
  React.useEffect(() => {
    (async () => {
      try {
        await refreshPortfolio();
        await refreshTrades();
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, []);

  /* ===============================
     Trade
  ================================ */
  async function trade(side: "buy" | "sell") {
    try {
      setError(null);
      setMessage(null);

      const token = await getBackendToken();

      const res = await fetch(
        "https://predix-backend.onrender.com/trade",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            market_id: marketId,
            outcome,
            side,
            shares,
            price,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Trade failed");

      setMessage(
        side === "buy"
          ? `Bought ${shares} @ ${price}`
          : `Sold ${shares} @ ${price}`
      );

      // 🔥 THIS WAS THE MISSING