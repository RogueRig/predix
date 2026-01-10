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

  async function addTestPosition() {
    const stored = localStorage.getItem("backend_token");
    if (stored === null) return;

    const authToken: string = stored;

    await fetch("https://predix-backend.onrender.com/portfolio", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        market_id: "btc-2025",
        outcome: "YES",
        shares: 10,
        avg_price: 0.62,
      }),
    });

    const res = await fetch(
      "https://predix-backend.onrender.com/portfolio",
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    const json = await res.json();
    setPortfolio(json.portfolio || []);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Portfolio</h1>

      {loading && <p>Loading portfolio…</p>}

      {!loading && portfolio.length === 0 && (
        <p>No positions yet. Add one to get started.</p>
      )}

      {portfolio.map((p) => (
        <pre
          key={p.id}
          style={{
            background: "#111",
            color: "#0f0",
            padding: 10,
            marginBottom: 8,
          }}
        >
          {JSON.stringify(p, null, 2)}
        </pre>
      ))}

      <button
        onClick={addTestPosition}
        disabled={loading}
        style={{ marginTop: 12 }}
      >
        ➕ Add Test Position
      </button>

      <br />
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