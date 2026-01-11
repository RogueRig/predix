import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

/* ===============================
   Guard
================================ */
function Protected({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  if (!ready) return <p>Loading…</p>;
  return authenticated ? <>{children}</> : <Navigate to="/" />;
}

/* ===============================
   Login
================================ */
function Login() {
  const { login } = usePrivy();
  return (
    <div style={{ padding: 20 }}>
      <h1>Predix</h1>
      <button onClick={login}>Login</button>
    </div>
  );
}

/* ===============================
   Portfolio
================================ */
function Portfolio() {
  const { getAccessToken, logout } = usePrivy();
  const [data, setData] = React.useState<any>(null);

  async function load() {
    let token = localStorage.getItem("backend_token");
    if (!token) {
      const privy = await getAccessToken();
      const r = await fetch(
        "https://predix-backend.onrender.com/auth/privy",
        { method: "POST", headers: { Authorization: `Bearer ${privy}` } }
      );
      const j = await r.json();
      token = j.token;
      localStorage.setItem("backend_token", token);
    }

    const res = await fetch(
      "https://predix-backend.onrender.com/portfolio",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setData(await res.json());
  }

  React.useEffect(() => {
    load();
  }, []);

  if (!data) return <p>Loading…</p>;

  return (
    <div style={{ padding: 20 }}>
      <h2>Balance: {data.balance.toFixed(2)}</h2>

      <h3>Positions</h3>
      {data.positions.map((p: any, i: number) => (
        <div key={i} style={{ border: "1px solid #333", marginBottom: 10, padding: 10 }}>
          <strong>{p.market_id} — {p.outcome}</strong>
          <div>Shares: {p.shares}</div>
          <div>Avg Price: {p.avg_price.toFixed(4)}</div>
          <div>Current Price: {p.current_price.toFixed(4)}</div>
          <div>Value: {p.position_value.toFixed(2)}</div>
          <div
            style={{ color: p.unrealized_pnl >= 0 ? "green" : "red" }}
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
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <PrivyProvider
    appId="cmk602oo400ebjs0cgw0vbbao"
    config={{ loginMethods: ["email", "wallet"] }}
  >
    <App />
  </PrivyProvider>
);