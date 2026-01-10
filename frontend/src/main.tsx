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
   📊 Portfolio Page (ROBUST)
================================ */
function PortfolioPage() {
  const { ready, getAccessToken, logout } = usePrivy();

  const [user, setUser] = React.useState<any>(null);
  const [status, setStatus] = React.useState<
    "loading" | "ready" | "error"
  >("loading");

  React.useEffect(() => {
    let cancelled = false;

    async function loadProfileWithRetry() {
      if (!ready) return;

      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          const token = await getAccessToken();

          // 🔁 Token not ready yet → wait and retry
          if (!token) {
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }

          const res = await fetch(
            "https://predix-backend.onrender.com/me",
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (!res.ok) {
            throw new Error("Backend auth failed");
          }

          const data = await res.json();

          if (!cancelled) {
            setUser(data.user);
            setStatus("ready");
          }
          return;
        } catch (err) {
          console.error("Profile load attempt failed:", err);
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      if (!cancelled) {
        setStatus("error");
      }
    }

    loadProfileWithRetry();

    return () => {
      cancelled = true;
    };
  }, [ready, getAccessToken]);

  if (status === "loading") {
    return <p style={{ padding: 20 }}>Loading your account…</p>;
  }

  if (status === "error") {
    return (
      <div style={{ padding: 20 }}>
        <p style={{ color: "red" }}>
          Failed to load profile from backend.
        </p>
        <button onClick={logout} style={{ padding: 12, fontSize: 16 }}>
          Logout
        </button>
      </div>
    );
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