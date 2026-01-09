import { createRoot } from "react-dom/client";

const root = document.getElementById("root");

if (!root) {
  document.body.innerHTML += "<p>❌ Root div not found</p>";
} else {
  createRoot(root).render(
    document.createElement(
      "div",
      { style: { padding: "16px", fontSize: "18px" } },
      "✅ Predix React mounted"
    )
  );
}