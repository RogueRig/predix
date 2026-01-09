import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App";

const root = document.getElementById("root");

if (!root) {
  document.body.innerHTML = "❌ root div not found";
} else {
  createRoot(root).render(
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "wallet"],
      }}
    >
      <App />
    </PrivyProvider>
  );
}