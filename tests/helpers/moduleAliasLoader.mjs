import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const runtimeStubURL = pathToFileURL(
  path.join(repositoryRoot, "tests/helpers/runtimeStubs.ts"),
).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/monitoring" || specifier === "@/utils/logger") {
    return { url: runtimeStubURL, shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    const sourcePath = path.join(repositoryRoot, "src", specifier.slice(2));
    const candidates = [
      sourcePath,
      `${sourcePath}.ts`,
      `${sourcePath}.tsx`,
      path.join(sourcePath, "index.ts"),
    ];
    const resolvedPath = candidates.find(existsSync);
    if (resolvedPath) {
      return {
        url: pathToFileURL(resolvedPath).href,
        shortCircuit: true,
      };
    }
  }

  return nextResolve(specifier, context);
}
