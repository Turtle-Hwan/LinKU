import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import svgr from "vite-plugin-svgr";
import fs from "fs";

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      svgr(),
      mode === "gh-pages" && copyBannersForGhPages(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // base를 상대경로로 설정
    base: "",
    build: {
      // 빌드 결과물이 dist/ 폴더에 생성되도록 설정
      outDir: mode === "gh-pages" ? "gh-pages" : "dist",
      // assets 폴더를 dist에 직접 생성
      assetsDir: "dist/assets",
      // public 폴더의 파일들을 dist로 복사
      copyPublicDir: true,
      rollupOptions: {
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
