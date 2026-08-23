import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const DEBUG_ID_PATTERN = /_sentryDebugIdIdentifier=`sentry-dbid-[0-9a-f-]{36}`/u;
const TEST_RELEASE = "linku@bundle-test";
const TEST_DSN = "https://public@example.invalid/1";
const TEST_GA_PROXY = "https://analytics.example.invalid/collect";

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(root, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return files.flat();
}

function runVite(mode, outputDir) {
  const result = spawnSync("pnpm", ["exec", "vite", "build", "--mode", mode], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      LINKU_BUILD_OUT_DIR: outputDir,
      SENTRY_BUNDLE_VERIFY: "1",
      VITE_SENTRY_DSN: TEST_DSN,
      VITE_SENTRY_ENVIRONMENT: "production",
      VITE_SENTRY_RELEASE: TEST_RELEASE,
      VITE_GA_PROXY_URL: TEST_GA_PROXY,
      VITE_GA_API_SECRET: "",
    },
  });

  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`Sentry bundle verification build failed for ${mode}`);
  }
}

async function assertEntrySourceMap(outputDir, entry, expectedSource) {
  const map = JSON.parse(await readFile(join(outputDir, `${entry}.map`), "utf8"));
  assert.ok(
    Array.isArray(map.sources) &&
      map.sources.some((source) => String(source).includes(expectedSource)),
    `${entry}.map does not reference ${expectedSource}`,
  );
}

const temporaryRoot = await mkdtemp(join(tmpdir(), "linku-sentry-bundle-"));
const outputDir = join(temporaryRoot, "dist");

try {
  runVite("production", outputDir);
  runVite("production-content", outputDir);

  const files = await listFiles(outputDir);
  const javascriptFiles = files.filter((file) => file.endsWith(".js"));
  assert.ok(javascriptFiles.length >= 3, "expected popup, background and content bundles");

  const javascriptSources = [];
  for (const file of javascriptFiles) {
    const source = await readFile(file, "utf8");
    javascriptSources.push(source);
    assert.match(source, DEBUG_ID_PATTERN, `${file} has no injected Debug ID`);
  }

  const combinedBundle = javascriptSources.join("\n");
  assert.ok(combinedBundle.includes(TEST_RELEASE), "bundle has no release");
  assert.ok(combinedBundle.includes("production"), "bundle has no environment");
  assert.ok(combinedBundle.includes("example.invalid"), "bundle has no test DSN");

  const backgroundSource = await readFile(
    join(outputDir, "background/index.js"),
    "utf8",
  );
  assert.ok(
    backgroundSource.includes(TEST_GA_PROXY),
    "background bundle has no configured analytics proxy",
  );
  for (const file of javascriptFiles) {
    if (file.endsWith("background/index.js")) continue;
    const source = await readFile(file, "utf8");
    assert.ok(
      !source.includes("mp/collect"),
      `${file} contains the background-owned GA transport`,
    );
  }

  await assertEntrySourceMap(outputDir, "main.js", "src/main.tsx");
  await assertEntrySourceMap(
    outputDir,
    "background/index.js",
    "src/background/index.ts",
  );
  await assertEntrySourceMap(
    outputDir,
    "content/everytime-timetable.js",
    "src/content/everytime-timetable.ts",
  );

  process.stdout.write(
    "Sentry bundle verification passed for popup, background and content.\n",
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
