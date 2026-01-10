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

  /* ---------- Polymarket markets ---------- */
  const [markets, setMarkets] = React.useState<any[]>([]);
  const [marketsLoading, setMarketsLoading] = React.useState(false);
  const [marketsError, setMarketsError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);

  /* ===============================
     Backend bootstrap (unchanged)
  ================================ */
  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!ready || !authenticated) return;

      try {
        setLoading(true);

        let backendToken: string | null =
          localStorage.getItem("backend_token");

        if (!backendToken) {
          let tempPrivyToken: string | null = null;

          for (let i = 0; i < 10; i++) {
            const t = await getAccessToken();
            if (t) {
              tempPrivyToken = t;
              break;
            }
            await new Promise((r) => setTimeout(r, 300));
          }

          if (!tempPrivyToken) throw new Error("Privy token unavailable");

          const authRes = await fetch(
            "https://predix-backend.onrender.com/auth/privy",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${tempPrivyToken}`,
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

        const pRes = await fetch(
          "https://predix-backend.onrender.com/portfolio",
          {
            headers: {
              Authorization: `Bearer ${backendToken}`,
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
     🌐 Fetch Top Polymarket Markets
     FRONTEND ONLY — GAMMA API
  ================================ */
  async function loadTopMarkets() {
    setMarketsLoading(true);
    setMarketsError(null);

    try {
      const res = await fetch(
        "https://gamma-api.polymarket.com/events?order=volume&direction=desc"
      );

      if (!res.ok) throw new Error("Failed to fetch Polymarket markets");

      const json = await res.json();
      const events = json?.data ?? [];

      const filtered = events
        .filter((e: any) => !e.resolved)
        .slice(0, 20);

      setMarkets(filtered);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      setMarketsError(err.message);
    } finally {
      setMarketsLoading(false);
    }
  }

  React.useEffect(() => {
    if (ready && authenticated) {
      loadTopMarkets();
    }
  }, [ready, authenticated]);

  /* ---------- totals ---------- */
  const totalPositions = portfolio.length;
  const totalShares = portfolio.reduce((sum, p) => sum + Number(p.shares), 0);
  const totalInvested = portfolio.reduce(
    (sum, p) => sum + Number(p.shares) * Number(p.avg_price),
    0
  );

  return (
    <div style={{ padding: 20 }}>
      <h1>Predix</h1>

      {/* ===== Polymarket Markets ===== */}
      <div
        style={{
          border: "1px solid #333",
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <h2>Top Polymarket Markets</h2>

        <button onClick={loadTopMarkets} disabled={marketsLoading}>
          {marketsLoading ? "Refreshing…" : "Refresh Prices"}
        </button>

        {lastUpdated && (
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            Last updated: {lastUpdated}
          </div>
        )}

        {marketsError && (
          <p style={{ color: "red", marginTop: 10 }}>{marketsError}</p>
        )}

        {markets.map((m) => (
          <div
            key={m.id}
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              background: "#111",
              color: "#fff",
            }}
          >
            <div style={{ fontWeight: "bold" }}>{m.title}</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Volume: {m.volume ?? "—"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Ends: {m.endDate ? new Date(m.endDate).toLocaleDateString() : "—"}
            </div>
          </div>
        ))}
      </div>

      {/* ===== Portfolio ===== */}
      <div
        style={{
          background: "#111",
          color: "#ffffff",
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div><strong>Total Positions:</strong> {totalPositions}</div>
        <div><strong>Total Shares:</strong> {totalShares}</div>
        <div><strong>Total Invested:</strong> {totalInvested.toFixed(2)}</div>
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