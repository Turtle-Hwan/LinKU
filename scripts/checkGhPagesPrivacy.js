import fs from "node:fs";
import path from "node:path";

const outputDirectory = path.resolve(import.meta.dirname, "../gh-pages");
const forbiddenMarkers = [
  "monitoring initialized",
  "LinKU Sentry smoke test",
  "global.onunhandledrejection",
];

function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(filePath);
    return entry.name.endsWith(".js") ? [filePath] : [];
  });
}

if (!fs.existsSync(outputDirectory)) {
  throw new Error("GitHub Pages output is missing. Run build:gh-pages first.");
}

const violations = listJavaScriptFiles(outputDirectory).flatMap((filePath) => {
  const source = fs.readFileSync(filePath, "utf8");
  return forbiddenMarkers
    .filter((marker) => source.includes(marker))
    .map((marker) => `${path.relative(outputDirectory, filePath)}: ${marker}`);
});

if (violations.length > 0) {
  throw new Error(
    `The no-network Pages bundle includes monitoring code:\n${violations.join("\n")}`,
  );
}

console.log("GitHub Pages bundles contain no monitoring reporter markers.");
