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
   📊 Portfolio Page
================================ */
function PortfolioPage() {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();

  const tokenRef = React.useRef<string | null>(null);

  const [balance, setBalance] = React.useState<number>(0);
  const [portfolio, setPortfolio] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState<string | null>(null);

  /* ===============================
     Bootstrap (STRICT NULL SAFE)
  ================================ */
  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!ready || !authenticated) return;

      try {
        setLoading(true);

        let token = localStorage.getItem("backend_token");

        if (token === null) {
          let privyToken: string | null = null;

          for (let i = 0; i < 10; i++) {
            const t = await getAccessToken();
            if (typeof t === "string") {
              privyToken = t;
              break;
            }
            await new Promise((r) => setTimeout(r, 300));
          }

          if (privyToken === null) {
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

          token = authJson.token;
          localStorage.setItem("backend_token", token);
        }

        // ✅ HARD NARROWING — THIS IS THE FIX
        if (typeof token !== "string") {
          throw new Error("Backend token missing");
        }

        const safeToken: string = token;

        tokenRef.current = safeToken;

        if (!cancelled) {
          await refreshAll(safeToken);
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
     Data Refresh
  ================================ */
  async function refreshAll(token: string) {
    const [pRes, mRes] = await Promise.all([
      fetch("https://predix-backend.onrender.com/portfolio", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch("https://predix-backend.onrender.com/portfolio/meta", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const pJson = await pRes.json();
    const mJson = await mRes.json();

    setPortfolio(Array.isArray(pJson.portfolio) ? pJson.portfolio : []);
    setBalance(typeof mJson.balance === "number" ? mJson.balance : 0);
  }

  if (loading) return <p style={{ padding: 20 }}>Loading…</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Portfolio</h1>
      <p><strong>Balance:</strong> {balance.toFixed(2)}</p>

      <button
        onClick={() => {
          localStorage.removeItem("backend_token");
          tokenRef.current = null;
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