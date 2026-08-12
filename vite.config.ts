import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import svgr from "vite-plugin-svgr";
import fs from "fs";

export default defineConfig(({ mode }) => {
  // Chrome Extension build configuration
  const isChromeExtension = mode !== "gh-pages";
  const rollupInput: Record<string, string> = isChromeExtension
    ? {
        main: path.resolve(__dirname, "index.html"),
        "background/index": path.resolve(
          __dirname,
          "src/background/index.ts",
        ),
        "content/everytime-timetable": path.resolve(
          __dirname,
          "src/content/everytime-timetable.ts",
        ),
      }
    : {
        main: path.resolve(__dirname, "web/index.html"),
        "share/index": path.resolve(__dirname, "web/share/index.html"),
      };

  return {
    plugins: [
      react(),
      tailwindcss(),
      svgr(),
      mode === "gh-pages" && copyBannersForGhPages(),
      mode === "gh-pages" && moveGhPagesWebFilesToRoot(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    publicDir: mode === "gh-pages" ? "web/public" : "public",
    base: mode === "gh-pages" ? "/LinKU/" : "",
    build: {
      // 빌드 결과물이 dist/ 폴더에 생성되도록 설정
      outDir: mode === "gh-pages" ? "gh-pages" : "dist",
      emptyOutDir: true,
      // assets 폴더를 dist에 직접 생성
      assetsDir: "dist/assets",
      // public 폴더의 파일들을 dist로 복사
      copyPublicDir: true,
      rollupOptions: {
        input: rollupInput,
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
    name: "copy-banners-gh-pages", // 플러그인 이름
    writeBundle() {
      const sourceDir = path.resolve(__dirname, "src/assets/banners"); // 복사할 폴더 경로
      const targetDir = path.resolve(__dirname, "gh-pages/banners"); // 대상 경로

      if (fs.existsSync(sourceDir)) {
        fs.mkdirSync(targetDir, { recursive: true }); // 대상 디렉토리 생성
        fs.cpSync(sourceDir, targetDir, { recursive: true }); // 파일 복사
        console.log(`Copied banners from ${sourceDir} to ${targetDir}`);
      } else {
        console.warn(`Source directory ${sourceDir} does not exist.`);
      }
    },
  };
}

function moveGhPagesWebFilesToRoot() {
  return {
    name: "move-gh-pages-web-files-to-root",
    closeBundle() {
      const outputDir = path.resolve(__dirname, "gh-pages");
      const webDir = path.resolve(outputDir, "web");
      if (!fs.existsSync(webDir)) return;

      const webIndex = path.resolve(webDir, "index.html");
      const rootIndex = path.resolve(outputDir, "index.html");
      if (fs.existsSync(rootIndex)) fs.rmSync(rootIndex);
      fs.renameSync(webIndex, rootIndex);

      const webShareIndex = path.resolve(webDir, "share/index.html");
      const shareDir = path.resolve(outputDir, "share");
      fs.mkdirSync(shareDir, { recursive: true });
      fs.renameSync(webShareIndex, path.resolve(shareDir, "index.html"));
      fs.rmSync(webDir, { recursive: true });
    },
  };
}
