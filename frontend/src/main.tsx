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
   🔐 Auth Guard (Privy ONLY)
================================ */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();

  if (!ready) {
    return <p style={{ padding: 20 }}>Loading Privy…</p>;
  }

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

  if (!ready) {
    return <p style={{ padding: 20 }}>Loading Privy…</p>;
  }

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>Predix</h1>
      <button onClick={login} style={{ padding: 12, fontSize: 16 }}>
        Login with Privy
      </button>
    </div>
  );
}

function PortfolioPage() {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();

  const [output, setOutput] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const backendTokenRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      if (!ready || !authenticated) return;

      setLoading(true);
      setOutput(null);

      try {
        // 1️⃣ Get Privy token
        let privyToken: string | null = null;
        for (let i = 0; i < 10; i++) {
          privyToken = await getAccessToken();
          if (privyToken) break;
          await new Promise((r) => setTimeout(r, 300));
        }

        if (!privyToken) {
          throw new Error("Privy token unavailable");
        }

        // 2️⃣ Exchange for backend JWT
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

        backendTokenRef.current = authJson.token;

        // 3️⃣ Call /me using BACKEND token
        const meRes = await fetch(
          "https://predix-backend.onrender.com/me",
          {
            headers: {
              Authorization: `Bearer ${backendTokenRef.current}`,
            },
          }
        );

        const meJson = await meRes.json();

        if (!meRes.ok) {
          throw new Error("Failed to load profile");
        }

        if (!cancelled) {
          setOutput(meJson);
        }
      } catch (err: any) {
        if (!cancelled) {
          setOutput({ error: err.message });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrapSession();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>Predix Portfolio</h1>

      {loading && <p>Loading session…</p>}

      {output && (
        <pre
          style={{
            background: "#111",
            color: "#0f0",
            padding: 12,
            overflowX: "auto",
            fontSize: 13,
          }}
        >
          {JSON.stringify(output, null, 2)}
        </pre>
      )}

      <div style={{ marginTop: 12 }}>
        <button
          onClick={logout}
          style={{ padding: 12, fontSize: 16 }}
        >
          Logout
        </button>
      </div>
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
   🔌 Mount React
================================ */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <PrivyProvider
    appId="cmk602oo400ebjs0cgw0vbbao"
    config={{
      loginMethods: ["email", "wallet"],
    }}
  >
    <App />
  </PrivyProvider>
);