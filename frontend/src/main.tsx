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
  if (!ready) return <p style={{ padding: 20 }}>Loading Privy…</p>;
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

  if (!ready) return <p style={{ padding: 20 }}>Loading Privy…</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Predix</h1>
      <button onClick={login}>Login with Privy</button>
    </div>
  );
}

/* ===============================
   📊 Portfolio Page
================================ */
function PortfolioPage() {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();

  const [portfolio, setPortfolio] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [markets, setMarkets] = React.useState<any[]>([]);
  const [marketsLoading, setMarketsLoading] = React.useState(false);
  const [marketsError, setMarketsError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);

  /* ===============================
     Backend bootstrap (NULL SAFE)
  ================================ */
  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!ready || !authenticated) return;

      try {
        setLoading(true);

        let backendToken = localStorage.getItem("backend_token");

        if (!backendToken) {
          let privyToken: string | null = null;

          for (let i = 0; i < 10; i++) {
            const t = await getAccessToken();
            if (t) {
              privyToken = t;
              break;
            }
            await new Promise((r) => setTimeout(r, 300));
          }

          if (!privyToken) {
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
          if (!authRes.ok || !authJson.token) {
            throw new Error("Backend auth failed");
          }

          backendToken = authJson.token;
          localStorage.setItem("backend_token", backendToken);
        }

        if (!backendToken) {
          throw new Error("Backend token missing");
        }

        const authToken: string = backendToken;

        const pRes = await fetch(
          "https://predix-backend.onrender.com/portfolio",
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        const pJson = await pRes.json();
        if (!pRes.ok) throw new Error("Failed to load portfolio");

        if (!cancelled) setPortfolio(pJson.portfolio || []);
      } catch {
        localStorage.removeItem("backend_token");
        if (!cancelled) setPortfolio([]);
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
     🌐 Polymarket markets (frontend)
  ================================ */
  async function loadTopMarkets() {
    setMarketsLoading(true);
    setMarketsError(null);

    try {
      const res = await fetch(
        "https://gamma-api.polymarket.com/events?order=volume&direction=desc"
      );

      if (!res.ok) throw new Error("Failed to fetch markets");

      const json = await res.json();
      const events = json?.data ?? [];

      setMarkets(events.filter((e: any) => !e.resolved).slice(0, 20));
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      setMarketsError(err.message);
    } finally {
      setMarketsLoading(false);
    }
  }

  React.useEffect(() => {
    if (ready && authenticated) loadTopMarkets();
  }, [ready, authenticated]);

  const totalPositions = portfolio.length;
  const totalShares = portfolio.reduce((s, p) => s + Number(p.shares), 0);
  const totalInvested = portfolio.reduce(
    (s, p) => s + Number(p.shares) * Number(p.avg_price),
    0
  );

  return (
    <div style={{ padding: 20 }}>
      <h1>Predix</h1>

      <button onClick={loadTopMarkets} disabled={marketsLoading}>
        {marketsLoading ? "Refreshing…" : "Refresh Markets"}
      </button>

      {lastUpdated && (
        <div style={{ fontSize: 12 }}>Last updated: {lastUpdated}</div>
      )}

      {marketsError && <p style={{ color: "red" }}>{marketsError}</p>}

      {markets.map((m) => (
        <div key={m.id} style={{ marginTop: 10 }}>
          <strong>{m.title}</strong>
        </div>
      ))}

      <hr />

      <div>
        <div>Total Positions: {totalPositions}</div>
        <div>Total Shares: {totalShares}</div>
        <div>Total Invested: {totalInvested.toFixed(2)}</div>
      </div>

      {loading && <p>Loading portfolio…</p>}
      {!loading && portfolio.length === 0 && <p>No positions yet.</p>}

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <PrivyProvider
    appId="cmk602oo400ebjs0cgw0vbbao"
    config={{ loginMethods: ["email", "wallet"] }}
  >
    <App />
  </PrivyProvider>
);