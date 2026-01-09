import React from "react";
import ReactDOM from "react-dom/client";

function Test() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Predix is alive ✅</h1>
      <p>If you see this, React is working.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Test />
  </React.StrictMode>
);