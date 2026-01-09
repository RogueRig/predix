import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

function App() {
  const { login, authenticated, ready, getAccessToken, logout } = usePrivy();

  if (!ready) {
    return <p>Loading Privy…</p>;
  }

  async function verifyBackendAuth() {
    try {
      const token = await getAccessToken();

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

      const data = await res.json();

      if (!res.ok) {
        alert("❌ Backend auth failed:\n" + JSON.stringify(data, null, 2));
        return;
      }

      alert("✅ Backend auth success:\n" + JSON.stringify(data, null, 2));
    } catch (err) {
      console.error(err);
      alert("❌ Error calling backend");
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>Predix</h1>

      {!authenticated ? (
        <button onClick={login} style={{ padding: 12, fontSize: 16 }}>
          Login with Privy
        </button>
      ) : (
        <>
          <p>✅ Logged in</p>

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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PrivyProvider
      appId="cmk602oo400ebjs0cgw0vbbao"
      config={{
        loginMethods: ["email", "wallet"],
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>
);