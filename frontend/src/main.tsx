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
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  if (!ready) return <p style={{ padding: 20 }}>Loading…</p>;
  return authenticated ? <>{children}</> : <Navigate to="/" replace />;
}

/* ===============================
   Login Page
================================ */
function LoginPage() {
  const { login, ready, authenticated } = usePrivy();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (ready && authenticated) navigate("/portfolio");
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
   Types
================================ */
type Position = {
  market_id: string;
  outcome: string;
  total_shares: number;
  avg_price: number;
};

/* ===============================
   Portfolio Page
================================ */
function PortfolioPage() {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();

  const [balance, setBalance] = React.useState(0);
  const [positions, setPositions] = React.useState<Position[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [marketId, setMarketId] = React.useState("test-market");
  const [outcome, setOutcome] = React.useState("YES");
  const [shares, setShares] = React.useState(10);
  const [price, setPrice] = React.useState(1);

  /* ===============================
     Backend Token
  ================================ */
  async function getBackendToken(): Promise<string> {
    const cached = localStorage.getItem("backend_token");
    if (cached) return cached;

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
     Refresh Balance
  ================================ */
  async function refreshBalance(token: string) {
    const res = await fetch(
      "https://predix-backend.onrender.com/portfolio/meta",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const json = await res.json();
    setBalance(Number(json.balance) || 0);
  }

  /* ===============================
     Refresh Positions (HARDENED)
  ================================ */
  async function refreshPositions(token: string) {
    const res = await fetch(
      "https://predix-backend.onrender.com/portfolio/positions",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const json = await res.json();

    const safe: Position[] = (json.positions || []).map((p: any) => ({
      market_id: String(p.market_id),
      outcome: String(p.outcome),
      total_shares: Number(p.total_shares) || 0,
      avg_price: Number(p.avg_price) || 0,
    }));

    setPositions(safe);
  }

  /* ===============================
     BUY
  ================================ */
  async function buy() {
    try {
      setError(null);
      setMessage(null);

      const token = await getBackendToken();

      const res = await fetch(
        "https://predix-backend.onrender.com/trade/buy",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            market_id: marketId,
            outcome,
            shares,
            price,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Trade failed");

      setMessage(`Bought ${shares} @ ${price}`);

      // 🔒 SERIAL refresh — no race conditions
      await refreshBalance(token);
      await refreshPositions(token);
    } catch (e: any) {
      setError(e.message);
    }
  }

  React.useEffect(() => {
    if (!ready || !authenticated) return;

    (async () => {
      const token = await getBackendToken();
      await refreshBalance(token);
      await refreshPositions(token);
      setLoading(false);
    })();
  }, [ready, authenticated]);

  if (loading) return <p style={{ padding: 20 }}>Loading…</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Portfolio</h1>

      <div
        style={{
          background: "#111",
          color: "#fff",
          padding: 16,
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <strong>Balance:</strong> {balance.toFixed(2)}
      </div>

      <h2>Positions</h2>

      {positions.length === 0 && <p>No positions</p>}

      {positions.map((p, i) => (
        <div
          key={i}
          style={{
            border: "1px solid #333",
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          <strong>
            {p.market_id} — {p.outcome}
          </strong>
          <div>Shares: {p.total_shares}</div>
          <div>Avg Price: {p.avg_price.toFixed(4)}</div>

          {/* SELL DISABLED UNTIL BACKEND SAFE */}
          <button disabled style={{ opacity: 0.5 }}>
            Sell (coming soon)
          </button>
        </div>
      ))}

      <h2>Buy (Paper)</h2>

      <input value={marketId} onChange={(e) => setMarketId(e.target.value)} />
      <br />
      <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
        <option>YES</option>
        <option>NO</option>
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
      <button onClick={buy}>Buy</button>

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
   App Root
================================ */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/portfolio"
          element={
            <ProtectedRoute>
              <PortfolioPage />
            </ProtectedRoute>
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