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
   🔐 Auth Guard
================================ */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  if (!ready) return <p style={{ padding: 20 }}>Loading…</p>;
  return authenticated ? <>{children}</> : <Navigate to="/" replace />;
}

/* ===============================
   🔑 Login Page
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
   📊 Portfolio + Trade Page
================================ */
function PortfolioPage() {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();

  const [backendToken, setBackendToken] = React.useState<string | null>(null);
  const [balance, setBalance] = React.useState<number>(0);
  const [portfolio, setPortfolio] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);

  /* Trade inputs */
  const [marketId, setMarketId] = React.useState("");
  const [outcome, setOutcome] = React.useState("YES");
  const [shares, setShares] = React.useState(1);
  const [price, setPrice] = React.useState(0.5);

  /* ===============================
     Bootstrap
  ================================ */
  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!ready || !authenticated) return;

      try {
        setLoading(true);

        let stored = localStorage.getItem("backend_token");

        if (typeof stored !== "string") {
          let privyToken: string | null = null;

          for (let i = 0; i < 10; i++) {
            const t = await getAccessToken();
            if (typeof t === "string") {
              privyToken = t;
              break;
            }
            await new Promise((r) => setTimeout(r, 300));
          }

          if (typeof privyToken !== "string") {
            throw new Error("Privy token unavailable");
          }

          const authRes = await fetch(
            "https://predix-backend.onrender.com/auth/privy",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${privyToken}`,
              },
            }
          );

          const authJson = await authRes.json();

          if (!authRes.ok || typeof authJson.token !== "string") {
            throw new Error("Backend auth failed");
          }

          stored = authJson.token;
          localStorage.setItem("backend_token", stored);
        }

        if (typeof stored !== "string") {
          throw new Error("Backend token missing");
        }

        if (!cancelled) {
          setBackendToken(stored);
          await refreshData(stored);
        }
      } catch {
        localStorage.removeItem("backend_token");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  /* ===============================
     Refresh Data
  ================================ */
  async function refreshData(token: string) {
    const [pRes, bRes] = await Promise.all([
      fetch("https://predix-backend.onrender.com/portfolio", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch("https://predix-backend.onrender.com/portfolio/meta", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const pJson = await pRes.json();
    const bJson = await bRes.json();

    setPortfolio(Array.isArray(pJson.portfolio) ? pJson.portfolio : []);
    setBalance(typeof bJson.balance === "number" ? bJson.balance : 0);
  }

  /* ===============================
     Trade
  ================================ */
  async function trade(type: "buy" | "sell") {
    if (typeof backendToken !== "string") return;

    setMessage(null);

    const res = await fetch(
      `https://predix-backend.onrender.com/trade/${type}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${backendToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `${type}-${Date.now()}`,
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

    if (!res.ok) {
      setMessage(json.error || "Trade failed");
      return;
    }

    setMessage(`${type.toUpperCase()} successful`);
    await refreshData(backendToken);
  }

  /* ===============================
     Render
  ================================ */
  if (loading) return <p style={{ padding: 20 }}>Loading portfolio…</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Portfolio</h1>
      <p><strong>Balance:</strong> {balance.toFixed(2)}</p>

      <div style={{ border: "1px solid #333", padding: 12, marginBottom: 20 }}>
        <h3>Trade</h3>

        <input
          placeholder="Market ID"
          value={marketId}
          onChange={(e) => setMarketId(e.target.value)}
          style={{ width: "100%", marginBottom: 6 }}
        />

        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          style={{ width: "100%", marginBottom: 6 }}
        >
          <option value="YES">YES</option>
          <option value="NO">NO</option>
        </select>

        <input
          type="number"
          min={1}
          value={shares}
          onChange={(e) => setShares(Number(e.target.value))}
          style={{ width: "100%", marginBottom: 6 }}
        />

        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          style={{ width: "100%", marginBottom: 10 }}
        />

        <button onClick={() => trade("buy")}>Buy</button>{" "}
        <button onClick={() => trade("sell")}>Sell</button>

        {message && <p style={{ marginTop: 8 }}>{message}</p>}
      </div>

      <h3>Positions</h3>
      {portfolio.length === 0 && <p>No positions yet.</p>}

      {portfolio.map((p, i) => (
        <div key={i} style={{ borderBottom: "1px solid #333", marginBottom: 8 }}>
          <div>{p.market_id} — {p.outcome}</div>
          <div>Shares: {p.shares}</div>
          <div>Avg price: {p.avg_price}</div>
        </div>
      ))}

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
   🚀 App Root
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
   🔌 Mount
================================ */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <PrivyProvider
    appId="cmk602oo400ebjs0cgw0vbbao"
    config={{ loginMethods: ["email", "wallet"] }}
  >
    <App />
  </PrivyProvider>
);