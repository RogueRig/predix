import { createRoot } from "react-dom/client";

const root = document.getElementById("root");

if (!root) {
  document.body.innerHTML = "<h1>❌ Root div not found</h1>";
} else {
  createRoot(root).render(
    <div style={{ padding: 20 }}>
      <h1>✅ Predix is rendering</h1>
      <p>If you see this, React works.</p>
    </div>
  );
}