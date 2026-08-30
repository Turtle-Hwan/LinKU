import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import svgr from "vite-plugin-svgr";
import fs from "node:fs";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig(({ mode }) => {
  const isContentScriptBuild = mode.endsWith("-content") || mode === "content";
  const isProductionBuild = mode === "production" || mode === "production-content";
  // Chrome Extension build configuration
  const isChromeExtension = mode !== "gh-pages";
  const pagesBase = process.env.CF_PAGES === "1" ? "/" : "/LinKU/";
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN?.trim();
  const sentryOrg = process.env.SENTRY_ORG?.trim();
  const sentryProject = process.env.SENTRY_PROJECT?.trim();
  const sentryRelease = process.env.SENTRY_RELEASE?.trim();
  const verifySentryBundle = process.env.SENTRY_BUNDLE_VERIFY === "1";
  const configuredOutDir = process.env.LINKU_BUILD_OUT_DIR?.trim();
  const canUploadSentry =
    isChromeExtension &&
    isProductionBuild &&
    Boolean(sentryAuthToken && sentryOrg && sentryProject);
  const canInjectSentryDebugIds =
    canUploadSentry ||
    (isChromeExtension && isProductionBuild && verifySentryBundle);
  const rollupInput: Record<string, string> | undefined = isContentScriptBuild
    ? {
        "content/everytime-timetable": path.resolve(
          import.meta.dirname,
          "src/content/everytime-timetable.ts",
        ),
      }
    : isChromeExtension
      ? {
          // Popup entry point
          main: path.resolve(import.meta.dirname, "index.html"),
          // Background service worker entry point
          "background/index": path.resolve(
            import.meta.dirname,
            "src/background/index.ts",
          ),
        }
      : {
          main: path.resolve(import.meta.dirname, "web/index.html"),
        };

  return {
    plugins: [
      react(),
      tailwindcss(),
      svgr(),
      canInjectSentryDebugIds &&
        sentryVitePlugin({
          org: canUploadSentry ? sentryOrg : undefined,
          project: canUploadSentry ? sentryProject : undefined,
          authToken: canUploadSentry ? sentryAuthToken : undefined,
          release: canUploadSentry && sentryRelease
            ? { name: sentryRelease, finalize: isContentScriptBuild }
            : undefined,
          sourcemaps: verifySentryBundle
            ? { disable: "disable-upload" }
            : { filesToDeleteAfterUpload: ["dist/**/*.map"] },
          telemetry: false,
          // A failed upload must fail the release build. The plugin resolves
          // successfully after an upload error, and `silent` hides the reason,
          // so a broken or under-scoped token would ship a release with no
          // usable source maps while leaving the workflow green.
          silent: false,
          errorHandler: (error) => {
            throw error;
          },
        }),
      mode === "gh-pages" && rejectMonitoringInGhPages(),
      mode === "gh-pages" && copyBannersForGhPages(),
      mode === "gh-pages" && moveGhPagesWebFilesToRoot(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    publicDir: mode === "gh-pages" ? "web/public" : "public",
    base: mode === "gh-pages" ? pagesBase : "",
    build: {
      sourcemap: canInjectSentryDebugIds ? "hidden" : false,
      modulePreload: isChromeExtension ? false : undefined,
      // 빌드 결과물이 dist/ 폴더에 생성되도록 설정
      outDir:
        configuredOutDir || (mode === "gh-pages" ? "gh-pages" : "dist"),
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

function rejectMonitoringInGhPages(): Plugin {
  return {
    name: "reject-monitoring-in-gh-pages",
    generateBundle(_options, bundle) {
      const bundledModules = new Set(
        Object.values(bundle).flatMap((output) =>
          output.type === "chunk" ? Object.keys(output.modules) : [],
        ),
      );
      const forbiddenModules = [...bundledModules].filter((moduleId) => {
        const normalizedId = moduleId.replaceAll("\\", "/");
        return (
          normalizedId.includes("/src/monitoring/") ||
          normalizedId.includes("/node_modules/@sentry/") ||
          normalizedId.includes("/node_modules/.pnpm/@sentry+")
        );
      });

      if (forbiddenModules.length > 0) {
        this.error(
          `The no-network Pages build includes monitoring modules:\n${forbiddenModules
            .map((moduleId) => path.relative(import.meta.dirname, moduleId))
            .join("\n")}`,
        );
      }

      console.log(
        `Verified ${bundledModules.size} GitHub Pages modules without monitoring dependencies.`,
      );
    },
  };
}

function copyBannersForGhPages() {
  return {
    name: "copy-banners-gh-pages", // 플러그인 이름
    writeBundle() {
      const sourceDir = path.resolve(import.meta.dirname, "src/assets/banners"); // 복사할 폴더 경로
      const targetDir = path.resolve(import.meta.dirname, "gh-pages/banners"); // 대상 경로

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
      const outputDir = path.resolve(import.meta.dirname, "gh-pages");
      const webDir = path.resolve(outputDir, "web");
      if (!fs.existsSync(webDir)) return;

      const webIndex = path.resolve(webDir, "index.html");
      const rootIndex = path.resolve(outputDir, "index.html");
      if (fs.existsSync(rootIndex)) fs.rmSync(rootIndex);
      fs.renameSync(webIndex, rootIndex);

      fs.rmSync(webDir, { recursive: true });
    },
  };
}
