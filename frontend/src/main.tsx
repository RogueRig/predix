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
   Auth Guard
================================ */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  if (!ready) return <p style={{ padding: 20 }}>Loading…</p>;
  return authenticated ? <>{children}</> : <Navigate to="/" replace />;
}

/* ===============================
   Login Page
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
   Portfolio Page
================================ */
function PortfolioPage() {
  const { ready, authenticated, getAccessToken, logout } = usePrivy();

  const [balance, setBalance] = React.useState(0);
  const [tokenVisible, setTokenVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  async function getBackendToken(): Promise<string> {
    const cached = localStorage.getItem("backend_token");
    if (typeof cached === "string") return cached;

    let privyToken: string | null = null;
    for (let i = 0; i < 10; i++) {
      const t = await getAccessToken();
      if (typeof t === "string") {
        privyToken = t;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!privyToken) throw new Error("Privy token unavailable");

    const res = await fetch(
      "https://predix-backend.onrender.com/auth/privy",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${privyToken}` },
      }
    );

    const json = await res.json();
    if (!res.ok || typeof json.token !== "string") {
      throw new Error("Backend auth failed");
    }

    localStorage.setItem("backend_token", json.token);
    return json.token;
  }

  async function refreshBalance() {
    const token = await getBackendToken();
    const res = await fetch(
      "https://predix-backend.onrender.com/portfolio/meta",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const json = await res.json();
    setBalance(Number(json.balance) || 0);
  }

  React.useEffect(() => {
    if (!ready || !authenticated) return;
    refreshBalance().finally(() => setLoading(false));
  }, [ready, authenticated]);

  if (loading) return <p style={{ padding: 20 }}>Loading…</p>;

  const backendToken = localStorage.getItem("backend_token");

  return (
    <div style={{ padding: 20 }}>
      <h1>Portfolio</h1>

      <div style={{ marginBottom: 10 }}>
        <strong>Balance:</strong> {balance.toFixed(2)}
      </div>

      <button onClick={() => setTokenVisible(!tokenVisible)}>
        {tokenVisible ? "Hide Backend Token" : "Show Backend Token"}
      </button>

      {tokenVisible && (
        <pre
          style={{
            marginTop: 10,
            padding: 10,
            background: "#111",
            color: "#0f0",
            wordBreak: "break-all",
          }}
        >
          {backendToken ?? "No token found"}
        </pre>
      )}

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
   App Root
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
   Mount
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