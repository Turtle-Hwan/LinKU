import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const cwd = resolve(scriptDir, "..");

execSync("pnpm exec next typegen", {
  cwd,
  stdio: "inherit",
});

const cacheLifeTypesPath = resolve(cwd, ".next/types/cache-life.d.ts");
mkdirSync(dirname(cacheLifeTypesPath), { recursive: true });

if (!existsSync(cacheLifeTypesPath)) {
  writeFileSync(cacheLifeTypesPath, "export {};\n");
}

execSync("pnpm exec tsc --noEmit --incremental false", {
  cwd,
  stdio: "inherit",
});
