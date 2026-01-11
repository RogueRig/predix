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

  const [balance, setBalance] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      if (!ready || !authenticated) return;

      try {
        setLoading(true);

        // 🔒 STEP 1: force backend token to be string OR throw
        let backendToken = localStorage.getItem("backend_token");

        if (backendToken === null) {
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

          const authJson: unknown = await authRes.json();

          if (
            !authRes.ok ||
            typeof authJson !== "object" ||
            authJson === null ||
            typeof (authJson as { token?: unknown }).token !== "string"
          ) {
            throw new Error("Backend auth failed");
          }

          backendToken = (authJson as { token: string }).token;
          localStorage.setItem("backend_token", backendToken);
        }

        // 🔒 STEP 2: HARD TYPE NARROWING
        if (typeof backendToken !== "string") {
          throw new Error("Backend token missing");
        }

        const token: string = backendToken;

        // 🔒 STEP 3: token is STRING — TS CANNOT ARGUE
        const res = await fetch(
          "https://predix-backend.onrender.com/portfolio/meta",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const json: unknown = await res.json();

        if (
          typeof json === "object" &&
          json !== null &&
          typeof (json as { balance?: unknown }).balance === "number"
        ) {
          if (!cancelled) {
            setBalance((json as { balance: number }).balance);
          }
        } else {
          if (!cancelled) setBalance(0);
        }
      } catch {
        localStorage.removeItem("backend_token");
        if (!cancelled) setBalance(0);
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
    return <p style={{ padding: 20 }}>Loading…</p>;
  }

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
        <strong>Balance:</strong> {balance.toFixed(2)}
      </div>

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