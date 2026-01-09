import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

/* ===============================
   🔐 Privy + Backend Test Button
================================ */

function App() {
  const { login, authenticated, user, logout } = usePrivy();

  async function verifyBackendAuth() {
    try {
      const res = await fetch(
        "https://predix-backend.onrender.com/auth/privy",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ user }),
        }
      );

      const data = await res.json();
      alert("✅ Backend verified:\n" + JSON.stringify(data, null, 2));
    } catch (err) {
      alert("❌ Backend auth failed");
      console.error(err);
    }
  }

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
      }}
    >
      <h1>Predix</h1>

      {!authenticated && (
        <button onClick={login} style={{ padding: 12, fontSize: 16 }}>
          Login with Privy
        </button>
      )}

      {authenticated && (
        <>
          <p>✅ Logged in</p>
          <pre
            style={{
              background: "#111",
              color: "#0f0",
              padding: 10,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(user, null, 2)}
          </pre>

          <button
            onClick={verifyBackendAuth}
            style={{ padding: 12, fontSize: 16, marginRight: 10 }}
          >
            Verify Backend Auth
          </button>

          <button
            onClick={logout}
            style={{ padding: 12, fontSize: 16 }}
          >
            Logout
          </button>
        </>
      )}
    </div>
  );
}

/* ===============================
   🚀 React Mount (DO NOT TOUCH)
================================ */

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PrivyProvider
      appId="cmk602oo400ebjs0cgw0vbbao"
      config={{
        loginMethods: ["email", "wallet"],
        appearance: {
          theme: "light",
        },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>
);