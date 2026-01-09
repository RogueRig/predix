import { createRoot } from "react-dom/client";

const rootEl = document.getElementById("root");

if (!rootEl) {
  document.body.innerHTML = "<h1>❌ Root div not found</h1>";
} else {
  const root = createRoot(rootEl);
  root.render(
    <div style={{ padding: 20, fontSize: 18 }}>
      ✅ Predix React Mounted Successfully
    </div>
  );
}