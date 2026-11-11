import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./index.css";
import App from "./App";
import { DataProvider } from "./lib/store";
import { ToastProvider } from "./components/ui";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DataProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </DataProvider>
  </StrictMode>,
);
