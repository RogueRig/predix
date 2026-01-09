import { createRoot } from "react-dom/client";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";

// Read Privy App ID from env
const appId = import.meta.env.VITE_PRIVY_APP_ID;

function App() {
  const { login, logout, authenticated, user } = usePrivy();

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont",
      }}
    >
      <h1>Predix</h1>

      {!authenticated ? (
        <button
          onClick={login}
          style={{
            padding: "12px 16px",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Login
        </button>
      ) : (
        <>
          <p style={{ marginTop: 16 }}>✅ Logged in</p>
          <p>User ID: {user?.id}</p>

          <button
            onClick={logout}
            style={{
              marginTop: 12,
              padding: "12px 16px",
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </>
      )}
    </div>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  document.body.innerHTML = "❌ Root element not found";
} else if (!appId) {
  createRoot(rootElement).render(
    <div style={{ padding: 24, color: "red" }}>
      ❌ Missing VITE_PRIVY_APP_ID
    </div>
  );
} else {
  createRoot(rootElement).render(
    <PrivyProvider appId={appId}>
      <App />
    </PrivyProvider>
  );
}