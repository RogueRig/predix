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

  /* ---------- market discovery state ---------- */
  const [marketUrl, setMarketUrl] = React.useState("");
  const [markets, setMarkets] = React.useState<any[]>([]);
  const [marketError, setMarketError] = React.useState<string | null>(null);
  const [searching, setSearching] = React.useState(false);

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

          if (tempPrivyToken === null) {
            throw new Error("Privy token unavailable");
          }

          const privyToken: string = tempPrivyToken;

          const authRes = await fetch(
            "https://predix-backend.onrender.com/auth/privy",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${privyToken}`,
              },
            }
          );

          const authJson: { token?: string } = await authRes.json();

          if (!authRes.ok || !authJson.token) {
            throw new Error("Backend auth failed");
          }

          backendToken = authJson.token;
          localStorage.setItem("backend_token", authJson.token);
        }

        if (backendToken === null) {
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

  /* ---------- discover market (frontend only) ---------- */
  async function discoverMarket() {
    setMarkets([]);
    setMarketError(null);
    setSearching(true);

    try {
      if (!marketUrl.includes("/event/")) {
        throw new Error("Invalid Polymarket event URL");
      }

      const slug = marketUrl.split("/event/")[1]?.split("?")[0];
      if (!slug) {
        throw new Error("Could not extract event slug");
      }

      const res = await fetch(
        `https://gamma-api.polymarket.com/events?slug=${encodeURIComponent(
          slug
        )}`
      );

      const json = await res.json();
      const event = json?.data?.[0];

      if (!event || !event.markets) {
        throw new Error("Event not found on Polymarket");
      }

      setMarkets(event.markets);
    } catch (err: any) {
      setMarketError(err.message);
    } finally {
      setSearching(false);
    }
  }

  /* ---------- totals ---------- */
  const totalPositions = portfolio.length;
  const totalShares = portfolio.reduce((sum, p) => sum + Number(p.shares), 0);
  const totalInvested = portfolio.reduce(
    (sum, p) => sum + Number(p.shares) * Number(p.avg_price),
    0
  );

  return (
    <div style={{ padding: 20 }}>
      <h1>Portfolio</h1>

      {/* Totals */}
      <div
        style={{
          background: "#111",
          color: "#ffffff",
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          fontSize: 16,
        }}
      >
        <div><strong>Total Positions:</strong> {totalPositions}</div>
        <div><strong>Total Shares:</strong> {totalShares}</div>
        <div>
          <strong>Total Invested:</strong> {totalInvested.toFixed(2)}
        </div>
      </div>

      {/* Market Discovery */}
      <div
        style={{
          border: "1px solid #333",
          borderRadius: 10,
          padding: 14,
          marginBottom: 20,
        }}
      >
        <h3>Discover Polymarket Market</h3>

        <input
          type="text"
          placeholder="Paste Polymarket event URL"
          value={marketUrl}
          onChange={(e) => setMarketUrl(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />

        <button onClick={discoverMarket} disabled={searching || !marketUrl}>
          {searching ? "Searching…" : "Find Markets"}
        </button>

        {marketError && (
          <p style={{ color: "red", marginTop: 8 }}>{marketError}</p>
        )}

        {markets.length > 0 && (
          <pre
            style={{
              background: "#111",
              color: "#0f0",
              padding: 10,
              marginTop: 10,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(markets, null, 2)}
          </pre>
        )}
      </div>

      {loading && <p>Loading portfolio…</p>}

      {!loading && portfolio.length === 0 && <p>No positions yet.</p>}

      {portfolio.map((p) => (
        <div
          key={p.id}
          style={{
            border: "1px solid #333",
            borderRadius: 10,
            padding: 14,
            marginBottom: 14,
            background: "#111",
            color: "#fff",
          }}
        >
          <div><strong>Market:</strong> {p.market_id}</div>
          <div><strong>Outcome:</strong> {p.outcome}</div>
          <div><strong>Shares:</strong> {p.shares}</div>
          <div><strong>Avg Price:</strong> {p.avg_price}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
            {new Date(p.created_at).toLocaleString()}
          </div>
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