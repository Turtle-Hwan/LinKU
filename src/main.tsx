/**
 * main.tsx - Application Entry Point
 * Standard React Router v6 pattern: createMemoryRouter + RouterProvider
 *
 * Note: Uses createMemoryRouter instead of createBrowserRouter
 * because Chrome Extensions have limitations with browser history API
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { routes } from "./routes";
import "./App.css";

// Create memory router with hash-based initial entry
// Hash routing allows deep linking in Chrome Extension popup
const router = createMemoryRouter(routes, {
  initialEntries: [window.location.hash.slice(1) || '/'],
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
