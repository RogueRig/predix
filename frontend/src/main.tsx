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
   📊 Portfolio Page (DIAGNOSTIC)
================================ */
function PortfolioPage() {
  const { ready, getAccessToken, logout } = usePrivy();

  const [output, setOutput] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  async function loadProfile() {
    setLoading(true);
    setOutput(null);

    try {
      if (!ready) {
        setOutput({ error: "Privy not ready yet" });
        return;
      }

      const token = await getAccessToken();

      if (!token) {
        setOutput({ error: "No access token returned from Privy" });
        return;
      }

      const res = await fetch(
        "https://predix-backend.onrender.com/me",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const text = await res.text();

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      setOutput({
        httpStatus: res.status,
        ok: res.ok,
        response: parsed,
      });
    } catch (err: any) {
      setOutput({
        error: err.message ?? "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

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
          onClick={loadProfile}
          style={{ padding: 12, fontSize: 16, marginRight: 10 }}
        >
          Reload Profile
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