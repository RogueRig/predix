import React from "react";
import ReactDOM from "react-dom/client";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

function App() {
  const { login, authenticated, ready } = usePrivy();

  if (!ready) return <p>Loading Privy…</p>;

  return (
    <div style={{ padding: 20 }}>
      <h1>Predix</h1>

      {!authenticated ? (
        <button onClick={login}>Login with Privy</button>
      ) : (
        <p>✅ Logged in</p>
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