import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

/* ===============================
   🔐 Privy + Backend Auth Test
================================ */

function App() {
  const {
    login,
    logout,
    authenticated,
    ready,
    user,
    getAccessToken,
  } = usePrivy();

  async function verifyBackendAuth() {
    try {
      const token = await getAccessToken();

      if (!token) {
        alert("❌ No Privy access token");
        return;
      }

      const res = await fetch(
        "https://predix-backend.onrender.com/auth/privy",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const data = await res.json();
      alert("✅ Backend verified:\n" + JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(err);
      alert("❌ Backend auth failed (see console)");
    }
  }

  if (!ready) {
    return <p>Loading Privy…</p>;
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
   🚀 React Mount
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