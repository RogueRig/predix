import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppPrivyProvider } from "./PrivyProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppPrivyProvider>
      <App />
    </AppPrivyProvider>
  </React.StrictMode>
);