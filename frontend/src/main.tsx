import { createRoot } from "react-dom/client";

const root = document.getElementById("root");

if (!root) {
  throw new Error("❌ Root div not found");
}

createRoot(root).render(
  <div style={{ padding: 20 }}>
    <h1>✅ Predix React is LIVE</h1>
    <p>If you see this, React is mounted correctly.</p>
  </div>
);