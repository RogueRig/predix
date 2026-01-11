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
   Portfolio Page
================================ */
function PortfolioPage() {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();

  const [balance, setBalance] = React.useState<number | null>(null);
  const [positions, setPositions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [marketId, setMarketId] = React.useState("test-market");
  const [outcome, setOutcome] = React.useState("YES");
  const [shares, setShares] = React.useState(10);
  const [price, setPrice] = React.useState(1);

  // 🔐 request version guard (KEY FIX)
  const requestVersion = React.useRef(0);

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
     SINGLE SOURCE REFRESH (FIX)
  ================================ */
  async function refreshAll() {
    const currentVersion = ++requestVersion.current;
    const token = await getBackendToken();

    const [balRes, posRes] = await Promise.all([
      fetch("https://predix-backend.onrender.com/portfolio/meta", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch("https://predix-backend.onrender.com/portfolio/positions", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    if (requestVersion.current !== currentVersion) return;

    if (balRes.ok) {
      const b = await balRes.json();
      if (typeof b.balance === "number") {
        setBalance(b.balance);
      }
    }

    if (posRes.ok) {
      const p = await posRes.json();
      setPositions(
        (p.positions || []).map((x: any) => ({
          ...x,
          total_shares: Number(x.total_shares),
          avg_price: Number(x.avg_price),
        }))
      );
    }
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
      await refreshAll();
    } catch (e: any) {
      setError(e.message);
    }
  }

  /* ===============================
     Initial Load
  ================================ */
  React.useEffect(() => {
    if (!ready || !authenticated) return;
    refreshAll().finally(() => setLoading(false));
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
        <strong>Balance:</strong>{" "}
        {balance === null ? "—" : balance.toFixed(2)}
      </div>

      <h2>Positions</h2>

      {positions.map((p, i) => (
        <div
          key={i}
          style={{ border: "1px solid #333", padding: 12, marginBottom: 10 }}
        >
          <strong>
            {p.market_id} — {p.outcome}
          </strong>
          <div>Shares: {p.total_shares}</div>
          <div>Avg Price: {p.avg_price.toFixed(4)}</div>
        </div>
      ))}

      <h2>Buy</h2>

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