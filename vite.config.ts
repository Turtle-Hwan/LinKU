import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // base를 상대경로로 설정
  base: "",
  build: {
    // 빌드 결과물이 dist/ 폴더에 생성되도록 설정
    outDir: "dist",
    // assets 폴더를 따로 생성하지 않고 dist에 직접 생성
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
});
