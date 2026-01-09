import React from "react";
import ReactDOM from "react-dom/client";
import {
  PrivyProvider,
  usePrivy
} from "@privy-io/react-auth";

/**
 * 🔹 App UI
 */
function App() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  if (!ready) {
    return (
      <div style={styles.center}>
        <p>Loading Predix…</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div style={styles.center}>
        <h1 style={styles.title}>Predix</h1>
        <p style={styles.text}>Prediction markets, simplified.</p>

        <button style={styles.primaryButton} onClick={login}>
          Login with Privy
        </button>
      </div>
    );
  }

  return (
    <div style={styles.center}>
      <h1 style={styles.title}>Welcome to Predix</h1>

      <p style={styles.text}>
        Logged in as:
        <br />
        <strong>{user?.id}</strong>
      </p>

      <button
        style={styles.secondaryButton}
        onClick={async () => {
          try {
            const res = await fetch(
              "https://YOUR-RENDER-URL.onrender.com/auth/privy",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ user }),
              }
            );

            const data = await res.json();
            alert(JSON.stringify(data, null, 2));
          } catch (err) {
            alert("Backend auth failed");
          }
        }}
      >
        Verify Backend Auth
      </button>

      <button style={styles.linkButton} onClick={logout}>
        Logout
      </button>
    </div>
  );
}

/**
 * 🔹 Render App
 */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PrivyProvider
      appId="YOUR_PRIVY_APP_ID"
      config={{
        appearance: {
          theme: "light",
          accentColor: "#6366f1",
        },
        loginMethods: ["email", "wallet"],
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>
);

/**
 * 🔹 Mobile-friendly inline styles
 */
const styles: Record<string, React.CSSProperties> = {
  center: {
    minHeight: "100vh",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    fontFamily: "system-ui, sans-serif",
  },
  title: {
    fontSize: "28px",
    marginBottom: "12px",
  },
  text: {
    fontSize: "16px",
    marginBottom: "20px",
    color: "#555",
  },
  primaryButton: {
    padding: "14px 20px",
    fontSize: "16px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "#6366f1",
    color: "white",
    cursor: "pointer",
    width: "100%",
    maxWidth: "280px",
  },
  secondaryButton: {
    padding: "12px 18px",
    fontSize: "14px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    backgroundColor: "#f9f9f9",
    cursor: "pointer",
    marginTop: "12px",
    width: "100%",
    maxWidth: "280px",
  },
  linkButton: {
    marginTop: "16px",
    background: "none",
    border: "none",
    color: "#6366f1",
    cursor: "pointer",
    fontSize: "14px",
  },
};