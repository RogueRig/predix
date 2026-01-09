import { createRoot } from "react-dom/client";

const root = document.getElementById("root");

if (!root) {
  document.body.innerHTML = "❌ root div not found";
} else {
  createRoot(root).render(
    <div style={{ padding: 20 }}>
      <h1>✅ Predix is rendering</h1>
      <p>If you see this, React works.</p>
    </div>
  );
}