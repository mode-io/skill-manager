import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CatalogProvider } from "./context/CatalogContext";
import { App } from "./App";
import "./styles/variables.css";
import "./styles/reset.css";
import "./styles/layout.css";
import "./styles/components.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CatalogProvider>
        <App />
      </CatalogProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
