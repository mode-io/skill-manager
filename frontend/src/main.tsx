import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import "./styles/index.css";

/* Feature-local CSS.
 * Order preserves the original app.css feature-section sequence so in-layer
 * ties resolve identically to pre-split behavior. Each file wraps its
 * contents in @layer features { … }. */
import "./components/detail/index.css";
import "./features/overview/styles/overview.css";
import "./features/marketplace/styles/cards.css";
import "./features/settings/styles/settings.css";
import "./features/slash-commands/styles/slash-commands.css";
import "./features/skills/styles/detail.css";
import "./features/skills/styles/board.css";
import "./components/matrix/matrix.css";
import "./features/marketplace/styles/panes.css";
import "./features/marketplace/styles/mcp-detail.css";
import "./features/mcp/styles/pages.css";
import "./features/mcp/styles/detail-sheet.css";
import "./features/mcp/styles/edit-dialogs.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
