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
    if (ready && authenticated) navigate("/portfolio", { replace: true });
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

    for (let i = 0; i < 10; i++) {
      const t = await getAccessToken();
      if (typeof t === "string") {
        const res = await fetch(
          "https://predix-backend.onrender.com/auth/privy",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${t}` },
          }
        );
        const json = await res.json();
        localStorage.setItem("backend_token", json.token);
        return json.token;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error("Privy token unavailable");
  }

  /* ===============================
     Load Portfolio
  ================================ */
  async function refreshPortfolio() {
    const token = await getBackendToken();
    const res = await fetch(
      "https://predix-backend.onrender.com/portfolio",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error);

    setBalance(Number(json.balance));
    setRealizedPnL(Number(json.realized_pnl));
    setUnrealizedPnL(Number(json.unrealized_pnl));
    setPositions(json.positions || []);
    setTrades(json.trades || []);
  }

  React.useEffect(() => {
    refreshPortfolio().catch((e) => setError(e.message));
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
      if (!res.ok) throw new Error(json.error);

      setMessage(
        side === "buy"
          ? `Bought ${shares} @ ${price}`
          : `Sold ${shares} @ ${price}`
      );

      await refreshPortfolio();
    } catch (e: any) {
      setError(e.message);
    }
  }

  /* ===============================
     Derived UI Metrics
  ================================ */
  const totalPositionValue = positions.reduce(
    (s, p) => s + Number(p.position_value),
    0
  );
  const equity = balance + totalPositionValue;

  return (
    <div style={{ padding: 20 }}>
      <h2>Account</h2>
      <div><strong>Balance:</strong> {balance.toFixed(2)}</div>
      <div><strong>Equity:</strong> {equity.toFixed(2)}</div>
      <div style={{ color: realizedPnL >= 0 ? "green" : "red" }}>
        Realized PnL: {realizedPnL.toFixed(2)}
      </div>
      <div style={{ color: unrealizedPnL >= 0 ? "green" : "red" }}>
        Unrealized PnL: {unrealizedPnL.toFixed(2)}
      </div>

      <h3>Positions</h3>
      {positions.length === 0 && <p>No positions</p>}
      {positions.map((p, i) => {
        const pct =
          p.avg_price > 0
            ? ((p.current_price - p.avg_price) / p.avg_price) * 100
            : 0;

        return (
          <div
            key={i}
            style={{ border: "1px solid #333", padding: 12, marginBottom: 8 }}
          >
            <strong>{p.market_id} — {p.outcome}</strong>
            <div>Shares: {p.shares}</div>
            <div>Avg Price: {p.avg_price.toFixed(4)}</div>
            <div>Current Price: {p.current_price.toFixed(4)}</div>
            <div>Value: {p.position_value.toFixed(2)}</div>
            <div style={{ color: pct >= 0 ? "green" : "red" }}>
              PnL: {p.unrealized_pnl.toFixed(2)} ({pct.toFixed(2)}%)
            </div>
          </div>
        );
      })}

      <h3>Trade History</h3>
      <table width="100%" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Side</th>
            <th>Market</th>
            <th>Outcome</th>
            <th>Shares</th>
            <th>Price</th>
            <th>PnL</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr
              key={i}
              style={{
                background: t.side === "buy" ? "#0a2" : "#400",
                color: "#fff",
              }}
            >
              <td>{t.side.toUpperCase()}</td>
              <td>{t.market_id}</td>
              <td>{t.outcome}</td>
              <td>{t.shares}</td>
              <td>{t.price}</td>
              <td>{Number(t.realized_pnl).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Trade</h3>
      <input value={marketId} onChange={(e) => setMarketId(e.target.value)} />
      <br />
      <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
        <option value="YES">YES</option>
        <option value="NO">NO</option>
      </select>
      <br />
      <input type="number" value={shares} onChange={(e) => setShares(+e.target.value)} />
      <br />
      <input type="number" value={price} onChange={(e) => setPrice(+e.target.value)} />
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