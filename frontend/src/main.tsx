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
    if (ready && authenticated) navigate("/dashboard");
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
   📊 Dashboard Page
================================ */
function DashboardPage() {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();

  const [backendToken, setBackendToken] = React.useState<string | null>(null);
  const [markets, setMarkets] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  /* ---------- bootstrap auth ---------- */
  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!ready || !authenticated) return;

      try {
        setLoading(true);
        setError(null);

        let token = localStorage.getItem("backend_token");

        if (!token) {
          const privyToken = await getAccessToken();
          if (!privyToken) {
            throw new Error("Privy token unavailable");
          }

          const res = await fetch(
            "https://predix-backend.onrender.com/auth/privy",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${privyToken}`,
              },
            }
          );

          const json: { token?: string } = await res.json();
          if (!res.ok || !json.token) {
            throw new Error("Backend auth failed");
          }

          token = json.token;
          localStorage.setItem("backend_token", token);
        }

        if (!cancelled) setBackendToken(token);
      } catch (err: any) {
        localStorage.removeItem("backend_token");
        if (!cancelled) setError(err.message || "Auth failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  /* ---------- fetch markets ---------- */
  React.useEffect(() => {
    if (!backendToken) return;

    async function loadMarkets() {
      try {
        setLoading(true);

        const res = await fetch(
          "https://predix-backend.onrender.com/polymarket/clob-top"
        );

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Failed to load markets");
        }

        setMarkets(Array.isArray(json.markets) ? json.markets : []);
      } catch (err: any) {
        setError(err.message || "Market fetch failed");
      } finally {
        setLoading(false);
      }
    }

    loadMarkets();
  }, [backendToken]);

  if (loading) return <p style={{ padding: 20 }}>Loading dashboard…</p>;
  if (error) return <p style={{ padding: 20, color: "red" }}>{error}</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Top Polymarket Markets</h1>

      {markets.length === 0 && <p>No markets available.</p>}

      {markets.map((m) => (
        <div
          key={m.market_id}
          style={{
            border: "1px solid #333",
            borderRadius: 10,
            padding: 14,
            marginBottom: 12,
            background: "#111",
            color: "#fff",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: 6 }}>
            {m.market_id}
          </div>

          {Array.isArray(m.outcomes) &&
            m.outcomes.map((o: any) => (
              <div key={o.name}>
                {o.name}: {(Number(o.price) * 100).toFixed(2)}%
              </div>
            ))}
        </div>
      ))}

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
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
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
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <PrivyProvider
    appId="cmk602oo400ebjs0cgw0vbbao"
    config={{ loginMethods: ["email", "wallet"] }}
  >
    <App />
  </PrivyProvider>
);