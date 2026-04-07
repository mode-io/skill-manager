import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import "./styles/variables.css";
import "./styles/reset.css";
import "./styles/scrollbars.css";
import "./styles/app.css";
import "./styles/ui.css";
import "./styles/skills.css";
import "./styles/marketplace.css";
import "./styles/drawers.css";
import "./styles/settings.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
