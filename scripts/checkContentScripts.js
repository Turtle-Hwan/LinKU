import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { fileURLToPath } from "node:url";

const contentScriptPaths = ["dist/content/everytime-timetable.js"];

for (const relativePath of contentScriptPaths) {
  const filePath = fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
  const source = readFileSync(filePath, "utf8");

  try {
    new Script(source, { filename: relativePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${relativePath} must be a standalone classic script: ${message}`,
      { cause: error },
    );
  }
}

console.log("Content scripts are valid standalone classic scripts.");
