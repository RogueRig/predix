import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";

createRoot(document.getElementById("root")!).render(
  <PrivyProvider appId={import.meta.env.VITE_PRIVY_APP_ID as string}>
    <div style={{ padding: 24 }}>
      <h1>Predix</h1>
      <p>Privy wrapper loaded</p>
    </div>
  </PrivyProvider>
);