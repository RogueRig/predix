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

  const [balance, setBalance] = React.useState<number>(0);
  const [positions, setPositions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  // Trade form state
  const [marketId, setMarketId] = React.useState("test-market");
  const [outcome, setOutcome] = React.useState("YES");
  const [shares, setShares] = React.useState<number>(10);
  const [price, setPrice] = React.useState<number>(1);

  /* ===============================
     Backend Token (SAFE)
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

    if (privyToken === null) {
      throw new Error("Privy token unavailable");
    }

    const res = await fetch(
      "https://predix-backend.onrender.com/auth/privy",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${privyToken}` },
      }
    );

    const json: unknown = await res.json();

    if (
      !res.ok ||
      typeof json !== "object" ||
      json === null ||
      typeof (json as { token?: unknown }).token !== "string"
    ) {
      throw new Error("Backend auth failed");
    }

    const token = (json as { token: string }).token;
    localStorage.setItem("backend_token", token);
    return token;
  }

  /* ===============================
     Balance
  ================================ */
  async function refreshBalance(token: string) {
    const res = await fetch(
      "https://predix-backend.onrender.com/portfolio/meta",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const json: unknown = await res.json();
    if (
      typeof json === "object" &&
      json !== null &&
      typeof (json as { balance?: unknown }).balance === "number"
    ) {
      setBalance((json as { balance: number }).balance);
    } else {
      setBalance(0);
    }
  }

  /* ===============================
     Positions
  ================================ */
  async function refreshPositions(token: string) {
    const res = await fetch(
      "https://predix-backend.onrender.com/portfolio/positions",
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const json: unknown = await res.json();
    if (
      typeof json === "object" &&
      json !== null &&
      Array.isArray((json as { positions?: unknown }).positions)
    ) {
      setPositions((json as { positions: any[] }).positions);
    } else {
      setPositions([]);
    }
  }

  /* ===============================
     BUY TRADE
  ================================ */
  async function buy() {
    try {
      setError(null);
      setMessage(null);

      const token = await getBackendToken();

      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `mobile-${Date.now()}`;

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
        throw new Error(`Backend error (${res.status}): ${text}`);
      }

      const json: any = await res.json();
      if (!res.ok) throw new Error(json.error || "Trade failed");

      setMessage(`Trade filled. Spent ${json.spent}`);

      await refreshBalance(token);
      await refreshPositions(token);
    } catch (e: any) {
      setError(e.message);
    }
  }

  /* ===============================
     Initial Load
  ================================ */
  React.useEffect(() => {
    if (!ready || !authenticated) return;

    (async () => {
      const token = await getBackendToken();
      await refreshBalance(token);
      await refreshPositions(token);
      setLoading(false);
    })();
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

      {/* ===== Positions ===== */}
      <div style={{ marginBottom: 20 }}>
        <h3>Positions</h3>

        {positions.length === 0 && <p>No positions yet</p>}

        {positions.map((p, i) => (
          <div
            key={i}
            style={{
              border: "1px solid #333",
              padding: 12,
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            <div><strong>Market:</strong> {p.market_id}</div>
            <div><strong>Outcome:</strong> {p.outcome}</div>
            <div><strong>Shares:</strong> {p.total_shares}</div>
            <div><strong>Avg Price:</strong> {p.avg_price}</div>
          </div>
        ))}
      </div>

      {/* ===== Trade UI ===== */}
      <div
        style={{
          border: "1px solid #333",
          padding: 16,
          borderRadius: 10,
          marginBottom: 20,
        }}
      >
        <h3>Trade (Paper)</h3>

        <input value={marketId} onChange={(e) => setMarketId(e.target.value)} />
        <br />

        <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="YES">YES</option>
          <option value="NO">NO</option>
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

        {message && <p style={{ color: "green" }}>{message}</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}
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