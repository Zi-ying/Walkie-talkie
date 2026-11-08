import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./app.tsx";
import "./index.css";

const rootElement: HTMLElement | null = document.getElementById("root");
if (rootElement === null) {
  throw new Error('Missing <div id="root"> in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
