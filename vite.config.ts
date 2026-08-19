import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import svgr from "vite-plugin-svgr";
import fs from "fs";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig(({ mode }) => {
  const isContentScriptBuild = mode.endsWith("-content") || mode === "content";
  const isProductionBuild = mode === "production" || mode === "production-content";
  // Chrome Extension build configuration
  const isChromeExtension = mode !== "gh-pages";
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim();
  const sentryOrg = process.env.SENTRY_ORG?.trim();
  const sentryProject = process.env.SENTRY_PROJECT?.trim();
  const sentryRelease = process.env.SENTRY_RELEASE?.trim();
  const canUploadSentry =
    isChromeExtension &&
    isProductionBuild &&
    Boolean(sentryAuthToken && sentryOrg && sentryProject);
  const rollupInput: Record<string, string> | undefined = isContentScriptBuild
    ? {
        "content/everytime-timetable": path.resolve(
          __dirname,
          "src/content/everytime-timetable.ts",
        ),
      }
    : isChromeExtension
      ? {
          // Popup entry point
          main: path.resolve(__dirname, "index.html"),
          // Background service worker entry point
          "background/index": path.resolve(
            __dirname,
            "src/background/index.ts",
          ),
        }
      : undefined;

  return {
    plugins: [
      react(),
      tailwindcss(),
      svgr(),
      canUploadSentry &&
        sentryVitePlugin({
          org: sentryOrg,
          project: sentryProject,
          authToken: sentryAuthToken,
          release: sentryRelease
            ? { name: sentryRelease, finalize: isContentScriptBuild }
            : undefined,
          sourcemaps: {
            filesToDeleteAfterUpload: ["dist/**/*.map"],
          },
          // A failed upload must fail the release build. The plugin resolves
          // successfully after an upload error, and `silent` hides the reason,
          // so a broken or under-scoped token would ship a release with no
          // usable source maps while leaving the workflow green.
          silent: false,
          errorHandler: (error) => {
            throw error;
          },
        }),
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
      sourcemap: canUploadSentry ? "hidden" : false,
      // 빌드 결과물이 dist/ 폴더에 생성되도록 설정
      outDir: mode === "gh-pages" ? "gh-pages" : "dist",
      emptyOutDir: !isContentScriptBuild,
      // assets 폴더를 dist에 직접 생성
      assetsDir: "dist/assets",
      // public 폴더의 파일들을 dist로 복사
      copyPublicDir: !isContentScriptBuild,
      rollupOptions: {
        input: rollupInput,
        output: {
          format: isContentScriptBuild ? "iife" : "es",
          codeSplitting: isContentScriptBuild ? false : undefined,
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
