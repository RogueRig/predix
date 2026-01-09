import { createRoot } from "react-dom/client";

const rootEl = document.getElementById("root");

if (!rootEl) {
  document.body.innerHTML = "❌ Root element not found";
} else {
  createRoot(rootEl).render(
    <div style={{ padding: 24, fontSize: 20 }}>
      ✅ React mounted successfully
    </div>
  );
}