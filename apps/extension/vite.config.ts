import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import svgr from "vite-plugin-svgr";
import fs from "fs";

const extensionRoot = __dirname;
const ghPagesDir = path.resolve(extensionRoot, "gh-pages");

export default defineConfig(({ mode }) => {
  const isChromeExtension = mode !== "gh-pages";

  return {
    root: extensionRoot,
    plugins: [
      react(),
      tailwindcss(),
      svgr(),
      mode === "gh-pages" && copyBannersForGhPages(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(extensionRoot, "./src"),
      },
    },
    base: "",
    build: {
      outDir:
        mode === "gh-pages"
          ? ghPagesDir
          : path.resolve(__dirname, "dist"),
      emptyOutDir: true,
      assetsDir: "assets",
      copyPublicDir: true,
      rollupOptions: {
        input: isChromeExtension
          ? {
              main: path.resolve(extensionRoot, "index.html"),
              "background/index": path.resolve(
                extensionRoot,
                "src/background/index.ts",
              ),
            }
          : undefined,
        output: {
          assetFileNames: "[name][extname]",
          chunkFileNames: "[name].js",
          entryFileNames: "[name].js",
        },
      },
    },
  };
});

function copyBannersForGhPages() {
  return {
    name: "copy-banners-gh-pages",
    writeBundle() {
      const sourceDir = path.resolve(extensionRoot, "src/assets/banners");
      const targetDir = path.resolve(ghPagesDir, "banners");

      if (fs.existsSync(sourceDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        fs.cpSync(sourceDir, targetDir, { recursive: true });
        console.log(`Copied banners from ${sourceDir} to ${targetDir}`);
      } else {
        console.warn(`Source directory ${sourceDir} does not exist.`);
      }
    },
  };
}
