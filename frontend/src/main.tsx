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
   📊 Portfolio Page (TS-SAFE)
================================ */
function PortfolioPage() {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();
  const [output, setOutput] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!ready || !authenticated) return;

      try {
        setLoading(true);

        // 1️⃣ Load backend token
        let backendToken = localStorage.getItem("backend_token");

        // 2️⃣ Exchange Privy token if needed
        if (!backendToken) {
          let privyToken: string | null = null;

          for (let i = 0; i < 10; i++) {
            privyToken = await getAccessToken();
            if (privyToken) break;
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

          if (!authRes.ok || !authJson.token) {
            throw new Error("Backend auth failed");
          }

          backendToken = authJson.token;
          localStorage.setItem("backend_token", backendToken);
        }

        // ✅ HARD GUARD — TS & runtime safe
        if (backendToken === null) {
          throw new Error("Backend token missing");
        }

        // 3️⃣ Call /me
        const meRes = await fetch(
          "https://predix-backend.onrender.com/me",
          {
            headers: {
              Authorization: `Bearer ${backendToken}`,
            },
          }
        );

        const meJson = await meRes.json();

        if (!meRes.ok) throw new Error("Failed to load profile");

        if (!cancelled) setOutput(meJson);
      } catch (err: any) {
        localStorage.removeItem("backend_token");
        if (!cancelled) setOutput({ error: err.message });
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

      {loading && <p>Loading…</p>}

      {output && (
        <pre style={{ background: "#111", color: "#0f0", padding: 12 }}>
          {JSON.stringify(output, null, 2)}
        </pre>
      )}

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