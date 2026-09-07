import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const buildOutDir = process.env.LINKU_BUILD_OUT_DIR?.trim() || "dist";
const contentScriptPaths = [resolve(projectRoot, buildOutDir, "content/everytime-timetable.js")];

for (const filePath of contentScriptPaths) {
  const source = readFileSync(filePath, "utf8");

  try {
    new Script(source, { filename: filePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${filePath} must be a standalone classic script: ${message}`,
      { cause: error },
    );
  }
}

console.log("Content scripts are valid standalone classic scripts.");
