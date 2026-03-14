/**
 * main.tsx - Application Entry Point
 * Standard React Router v6 pattern: createHashRouter + RouterProvider
 *
 * Note: Uses createHashRouter for Chrome Extensions
 * - Automatically syncs route state with URL hash
 * - Preserves route on page refresh
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { routes } from "./routes";
import "./App.css";

// Create hash router for Chrome Extension
// Hash routing allows deep linking and preserves state on refresh
const router = createHashRouter(routes);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
