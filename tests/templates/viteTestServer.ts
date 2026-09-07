import { createServer as createHttpServer } from "node:http";
import path from "node:path";
import { createServer, type Plugin } from "vite";

/** Loads browser-facing modules without starting a network listener or HMR. */
export function createTemplateTestServer(plugins: Plugin[] = []) {
  const hmrServer = createHttpServer();
  return createServer({
    appType: "custom",
    configFile: false,
    logLevel: "silent",
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "../../src"),
      },
    },
    // Middleware mode otherwise opens Vite's default websocket port even
    // though these tests never listen on HTTP. An unbound server gives HMR a
    // lifecycle owner without creating a network listener.
    server: { hmr: { server: hmrServer }, middlewareMode: true },
  });
}
