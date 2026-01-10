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
   📊 Portfolio Page
================================ */
function PortfolioPage() {
  const { getAccessToken, logout } = usePrivy();
  const navigate = useNavigate();

  const [user, setUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("No token");

        const res = await fetch(
          "https://predix-backend.onrender.com/me",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) throw new Error("Backend auth failed");

        const data = await res.json();
        if (!cancelled) setUser(data.user);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Session expired. Please login again.");
          setTimeout(() => navigate("/"), 1500);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, navigate]);

  if (loading) {
    return <p style={{ padding: 20 }}>Loading your account…</p>;
  }

  if (error) {
    return <p style={{ padding: 20, color: "red" }}>{error}</p>;
  }

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>Predix Portfolio</h1>
      <p>✅ Backend authenticated</p>

      <pre
        style={{
          background: "#111",
          color: "#0f0",
          padding: 12,
          overflowX: "auto",
        }}
      >
        {JSON.stringify(user, null, 2)}
      </pre>

      <button
        onClick={logout}
        style={{ padding: 12, fontSize: 16, marginTop: 12 }}
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
   🔌 Mount React (NO StrictMode)
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