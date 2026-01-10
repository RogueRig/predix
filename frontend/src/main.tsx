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
   📊 Portfolio Page (OPTION C)
================================ */
function PortfolioPage() {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();

  const [user, setUser] = React.useState<any>(null);
  const [portfolio, setPortfolio] = React.useState<any[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!ready || !authenticated) return;

      try {
        setLoading(true);
        setError(null);

        /* ---------- BACKEND TOKEN ---------- */
        let backendToken = localStorage.getItem("backend_token");

        if (!backendToken) {
          let privyToken: string | undefined;

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

          const authJson: { token?: string } = await authRes.json();

          if (!authRes.ok || !authJson.token) {
            throw new Error("Backend auth failed");
          }

          backendToken = authJson.token;
          localStorage.setItem("backend_token", backendToken);
        }

        if (typeof backendToken !== "string") {
          throw new Error("Backend token missing");
        }

        const headers = {
          Authorization: `Bearer ${backendToken}`,
        };

        /* ---------- FETCH USER ---------- */
        const meRes = await fetch(
          "https://predix-backend.onrender.com/me",
          { headers }
        );
        const meJson = await meRes.json();
        if (!meRes.ok) throw new Error("Failed to load profile");

        /* ---------- FETCH PORTFOLIO ---------- */
        const pfRes = await fetch(
          "https://predix-backend.onrender.com/portfolio",
          { headers }
        );
        const pfJson = await pfRes.json();
        if (!pfRes.ok) throw new Error("Failed to load portfolio");

        if (!cancelled) {
          setUser(meJson.user);
          setPortfolio(pfJson.portfolio ?? []);
        }
      } catch (err: any) {
        localStorage.removeItem("backend_token");
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  if (loading) {
    return <p style={{ padding: 20 }}>Loading portfolio…</p>;
  }

  if (error) {
    return (
      <div style={{ padding: 20 }}>
        <p style={{ color: "red" }}>{error}</p>
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

  return (
    <div style={{ padding: 20 }}>
      <h1>Portfolio</h1>

      <h3>User</h3>
      <pre>{JSON.stringify(user, null, 2)}</pre>

      <h3>Positions</h3>

      {portfolio.length === 0 && <p>No positions yet.</p>}

      {portfolio.map((p) => (
        <div
          key={p.id}
          style={{
            border: "1px solid #ddd",
            padding: 10,
            marginBottom: 10,
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