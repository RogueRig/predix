import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";

const appId = import.meta.env.VITE_PRIVY_APP_ID;

createRoot(document.getElementById("root")!).render(
  appId ? (
    <PrivyProvider appId={appId}>
      <div style={{ padding: 24 }}>
        <h1>Predix</h1>
        <p>Privy loaded correctly</p>
      </div>
    </PrivyProvider>
  ) : (
    <div style={{ padding: 24, color: "red" }}>
      ❌ Missing VITE_PRIVY_APP_ID
    </div>
  )
);