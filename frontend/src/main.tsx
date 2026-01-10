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
  const [profile, setProfile] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  async function verifyBackendAuth() {
    try {
      const token = await getAccessToken();
      if (!token) return alert("No token");

      const res = await fetch(
        "https://predix-backend.onrender.com/auth/privy",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      alert(JSON.stringify(data, null, 2));
    } catch {
      alert("Backend auth failed");
    }
  }

  async function fetchMyProfile() {
    try {
      setLoading(true);
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch(
        "https://predix-backend.onrender.com/me",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();
      setProfile(data);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>Predix Portfolio</h1>
      <p>✅ Logged in</p>

      <div style={{ marginBottom: 12 }}>
        <button
          onClick={verifyBackendAuth}
          style={{ padding: 12, fontSize: 16, marginRight: 10 }}
        >
          Verify Backend Auth
        </button>

        <button
          onClick={fetchMyProfile}
          style={{ padding: 12, fontSize: 16 }}
        >
          Get My Profile
        </button>
      </div>

      {loading && <p>Loading profile…</p>}

      {profile && (
        <pre
          style={{
            background: "#111",
            color: "#0f0",
            padding: 12,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(profile, null, 2)}
        </pre>
      )}

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