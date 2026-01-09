import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppPrivyProvider } from "./PrivyProvider";

function Root() {
  try {
    return (
      <AppPrivyProvider>
        <App />
      </AppPrivyProvider>
    );
  } catch (e) {
    return (
      <div style={{ padding: 24, color: "red" }}>
        <h2>Predix crashed</h2>
        <pre>{String(e)}</pre>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);