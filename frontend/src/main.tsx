import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

/* ===============================
   Auth Guard
================================ */
function Protected({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  if (!ready) return <p style={{ padding: 20 }}>Loading…</p>;
  return authenticated ? <>{children}</> : <Navigate to="/" replace />;
}

/* ===============================
   Login
================================ */
function Login() {
  const { login } = usePrivy();
  return (
    <div style={{ padding: 20 }}>
      <h1>Predix</h1>
      <button onClick={login}>Login with Privy</button>
    </div>
  );
}

/* ===============================
   Portfolio
================================ */
function Portfolio() {
  const { getAccessToken, logout } = usePrivy();
  const [data, setData] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /* ===============================
     STRICT TOKEN HELPERS
  ================================ */

  async function getPrivyTokenStrict(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const t = await getAccessToken();
      if (typeof t === "string") return t;
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error("Privy token unavailable");
  }

  async function getBackendTokenStrict(): Promise<string> {
    const cached = localStorage.getItem("backend_token");
    if (typeof cached === "string") return cached;

    const privyToken = await getPrivyTokenStrict();

    const res = await fetch(
      "https://predix-backend.onrender.com/auth/privy",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${privyToken}`,
        },
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

    const backendToken = (json as { token: string }).token;
    localStorage.setItem("backend_token", backendToken);
    return backendToken;
  }

  /* ===============================
     Load Portfolio
  ================================ */
  async function loadPortfolio(): Promise<void> {
    try {
      setError(null);

      const token = await getBackendTokenStrict();

      const res = await fetch(
        "https://predix-backend.onrender.com/portfolio",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Backend error ${res.status}`);
      }

      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    }
  }

  React.useEffect(() => {
    loadPortfolio();
  }, []);

  if (error) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        Error: {error}
      </div>
    );
  }

  if (!data) {
    return <p style={{ padding: 20 }}>Loading…</p>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Balance: {data.balance.toFixed(2)}</h2>

      <h3>Positions</h3>

      {data.positions.length === 0 && <p>No positions</p>}

      {data.positions.map((p: any, i: number) => (
        <div
          key={i}
          style={{
            border: "1px solid #333",
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
          }}
        >
          <strong>
            {p.market_id} — {p.outcome}
          </strong>
          <div>Shares: {p.shares}</div>
          <div>Avg Price: {p.avg_price.toFixed(4)}</div>
          <div>Current Price: {p.current_price.toFixed(4)}</div>
          <div>Position Value: {p.position_value.toFixed(2)}</div>
          <div
            style={{
              color: p.unrealized_pnl >= 0 ? "green" : "red",
            }}
          >
            Unrealized PnL: {p.unrealized_pnl.toFixed(2)}
          </div>
        </div>
      ))}

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
   App
================================ */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/portfolio"
          element={
            <Protected>
              <Portfolio />
            </Protected>
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