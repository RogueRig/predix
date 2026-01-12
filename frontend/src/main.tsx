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
  const { ready, authenticated, getAccessToken, logout } = usePrivy();

  const [loading, setLoading] = React.useState(true);
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
     Backend Token (STRICT + STABLE)
  ================================ */
  async function getBackendToken(): Promise<string> {
    const cached = localStorage.getItem("backend_token");
    if (typeof cached === "string") return cached;

    let privyToken: string | null = null;

    for (let i = 0; i < 15; i++) {
      const t = await getAccessToken();
      if (typeof t === "string") {
        privyToken = t;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!privyToken) {
      throw new Error("Privy token unavailable");
    }

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
     Load Portfolio (SINGLE SOURCE)
  ================================ */
  async function loadPortfolio() {
    const token = await getBackendToken();

    const res = await fetch(
      "https://predix-backend.onrender.com/portfolio",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Failed to load portfolio");
    }

    setBalance(Number(json.balance ?? 0));
    setRealizedPnL(Number(json.realized_pnl ?? 0));
    setUnrealizedPnL(Number(json.unrealized_pnl ?? 0));
    setPositions(json.positions ?? []);
    setTrades(json.trades ?? []);
  }

  /* ===============================
     Initial Load (CRITICAL FIX)
  ================================ */
  React.useEffect(() => {
    if (!ready || !authenticated) return;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        await loadPortfolio();
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated]);

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

      await loadPortfolio();
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) {
    return <p style={{ padding: 20 }}>Loading portfolio…</p>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Balance: {balance.toFixed(2)}</h2>
      <div>Realized PnL: {realizedPnL.toFixed(2)}</div>
      <div>Unrealized PnL: {unrealizedPnL.toFixed(2)}</div>

      <h3>Positions</h3>
      {positions.length === 0 && <p>No positions</p>}
      {positions.map((p, i) => (
        <div
          key={i}
          style={{ border: "1px solid #333", padding: 12, marginBottom: 8 }}
        >
          <strong>
            {p.market_id} — {p.outcome}
          </strong>
          <div>Shares: {p.shares}</div>
          <div>Avg Price: {p.avg_price.toFixed(4)}</div>
          <div>Current Price: {p.current_price.toFixed(4)}</div>
          <div>Position Value: {p.position_value.toFixed(2)}</div>
          <div
            style={{
              color: p.unrealized_pnl >= 0 ? "lime" : "red",
            }}
          >
            Unrealized PnL: {p.unrealized_pnl.toFixed(2)}
          </div>
        </div>
      ))}

      <h3>Trade History</h3>
      {trades.length === 0 && <p>No trades</p>}
      {trades.map((t, i) => (
        <div
          key={i}
          style={{
            padding: 8,
            background: t.side === "buy" ? "#102010" : "#201010",
            marginBottom: 6,
          }}
        >
          {t.side.toUpperCase()} {t.shares} {t.market_id} @ {t.price}
        </div>
      ))}

      <h3>Trade</h3>

      <input value={marketId} onChange={(e) => setMarketId(e.target.value)} />
      <br />
      <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
        <option value="YES">YES</option>
        <option value="NO">NO</option>
      </select>
      <br />
      <input
        type="number"
        value={shares}
        onChange={(e) => setShares(Number(e.target.value))}
      />
      <br />
      <input
        type="number"
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
      />
      <br />

      <button onClick={() => trade("buy")}>Buy</button>
      <button onClick={() => trade("sell")} style={{ marginLeft: 10 }}>
        Sell
      </button>

      {message && <p style={{ color: "green" }}>{message}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <br />
      <button
        onClick={() => {
          localStorage.removeItem("backend_token");
          logout();
        }}
      >
        Logout
      </button>
    </div>
  );
}

/* ===============================
   App
================================ */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/portfolio"
          element={
            <Protected>
              <Portfolio />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/* ===============================
   Mount
================================ */
ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
).render(
  <PrivyProvider
    appId="cmk602oo400ebjs0cgw0vbbao"
    config={{ loginMethods: ["email", "wallet"] }}
  >
    <App />
  </PrivyProvider>
);