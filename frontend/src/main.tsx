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
    if (ready && authenticated) {
      navigate("/portfolio");
    }
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
  const [loading, setLoading] = React.useState<boolean>(true);

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

  return (
    <div style={{ padding: 20 }}>
      <h1>Portfolio</h1>

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
   🔌 Mount (STRICT-SAFE)
================================ */
const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootEl).render(
  <PrivyProvider
    appId="cmk602oo400ebjs0cgw0vbbao"
    config={{ loginMethods: ["email", "wallet"] }}
  >
    <App />
  </PrivyProvider>
);