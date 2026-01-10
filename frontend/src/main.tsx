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
   🔐 Auth Guard
================================ */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();

  if (!ready) return <p>Loading Privy…</p>;

  return authenticated ? <>{children}</> : <Navigate to="/" replace />;
}

/* ===============================
   🔑 Login Page
================================ */
function LoginPage() {
  const { login, ready, authenticated } = usePrivy();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (ready && authenticated) {
      navigate("/portfolio");
    }
  }, [ready, authenticated, navigate]);

  if (!ready) return <p>Loading Privy…</p>;

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>Predix</h1>
      <button onClick={login} style={{ padding: 12, fontSize: 16 }}>
        Login with Privy
      </button>
    </div>
  );
}

/* ===============================
   📊 Portfolio (Protected)
================================ */
function PortfolioPage() {
  const { logout, getAccessToken } = usePrivy();

  async function verifyBackendAuth() {
    try {
      const token = await getAccessToken();

      if (!token) {
        alert("❌ No access token returned from Privy");
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
      <h1>Predix Portfolio</h1>
      <p>✅ Logged in</p>

      <button
        onClick={verifyBackendAuth}
        style={{ padding: 12, fontSize: 16, marginRight: 10 }}
      >
        Verify Backend Auth
      </button>

      <button onClick={logout} style={{ padding: 12, fontSize: 16 }}>
        Logout
      </button>
    </div>
  );
}

/* ===============================
   🚀 App Root
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
   🔌 Mount React
================================ */
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