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

/* ===============================
   📊 Portfolio Page (CORRECT FLOW)
================================ */
function PortfolioPage() {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();

  const [backendToken, setBackendToken] = React.useState<string | null>(null);
  const [output, setOutput] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function runAuthFlow() {
      if (!ready || !authenticated) return;

      setLoading(true);
      setOutput(null);

      // 1️⃣ Get Privy token
      let privyToken: string | null = null;
      for (let i = 0; i < 10; i++) {
        privyToken = await getAccessToken();
        if (privyToken) break;
        await new Promise((r) => setTimeout(r, 300));
      }

      if (!privyToken) {
        if (!cancelled) {
          setOutput({ error: "Privy token not available" });
          setLoading(false);
        }
        return;
      }

      try {
        // 2️⃣ Exchange Privy token → backend token
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

        const backendJwt = authJson.token;
        setBackendToken(backendJwt);

        // 3️⃣ Call /me with BACKEND token
        const meRes = await fetch(
          "https://predix-backend.onrender.com/me",
          {
            headers: {
              Authorization: `Bearer ${backendJwt}`,
            },
          }
        );

        const meText = await meRes.text();
        let parsed;
        try {
          parsed = JSON.parse(meText);
        } catch {
          parsed = meText;
        }

        if (!cancelled) {
          setOutput({
            httpStatus: meRes.status,
            ok: meRes.ok,
            response: parsed,
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setOutput({ error: err.message ?? "Unknown error" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    runAuthFlow();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>Predix Portfolio</h1>

      {loading && <p>Loading profile…</p>}

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
          onClick={() => window.location.reload()}
          style={{ padding: 12, fontSize: 16, marginRight: 10 }}
        >
          Reload
        </button>

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