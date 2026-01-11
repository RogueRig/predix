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
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [marketId, setMarketId] = React.useState("test-market");
  const [outcome, setOutcome] = React.useState("YES");
  const [shares, setShares] = React.useState(10);
  const [price, setPrice] = React.useState(1);

  /* ===============================
     Backend Token (MOBILE SAFE)
  ================================ */
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

    if (!privyToken) {
      throw new Error("Privy token unavailable");
    }

    const res = await fetch(
      "https://predix-backend.onrender.com/auth/privy",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${privyToken}`,
        },
      }
    );

    const json = await res.json();

    if (!res.ok || typeof json.token !== "string") {
      throw new Error("Backend auth failed");
    }

    localStorage.setItem("backend_token", json.token);
    return json.token;
  }

  /* ===============================
     Balance
  ================================ */
  async function refreshBalance() {
    const token = await getBackendToken();

    const res = await fetch(
      "https://predix-backend.onrender.com/portfolio/meta",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const json = await res.json();
    setBalance(Number(json.balance) || 0);
  }

  /* ===============================
     BUY (MOBILE SAFE)
  ================================ */
  async function buy() {
    try {
      setError(null);
      const token = await getBackendToken();

      // ✅ MOBILE-SAFE idempotency key (NO crypto.randomUUID)
      const idempotencyKey =
        "mobile-" + Date.now().toString() + "-" + Math.random().toString(36);

      const res = await fetch(
        "https://predix-backend.onrender.com/trade/buy",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            market_id: marketId,
            outcome,
            shares,
            price,
          }),
        }
      );

      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(
          `Backend error (${res.status}): ${text.slice(0, 120)}`
        );
      }

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Trade failed");
      }

      await refreshBalance();
    } catch (e: any) {
      setError(e.message || "Trade failed");
    }
  }

  React.useEffect(() => {
    if (!ready || !authenticated) return;
    refreshBalance().finally(() => setLoading(false));
  }, [ready, authenticated]);

  if (loading) return <p style={{ padding: 20 }}>Loading…</p>;

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

      <div style={{ border: "1px solid #333", padding: 16, borderRadius: 10 }}>
        <h3>Trade (Paper)</h3>

        <input
          value={marketId}
          onChange={(e) => setMarketId(e.target.value)}
        />
        <br />

        <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option>YES</option>
          <option>NO</option>
        </select>
        <br />

        <input
          type="number"
          value={shares}
          onChange={(e) => setShares(Number(e.target.value))}
        />
        <br />

        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
        <br />

        <button onClick={buy}>Buy</button>

        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>

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