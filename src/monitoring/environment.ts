export function resolveSentryEnvironment(
  configuredEnvironment: string | undefined,
  mode: string,
): string {
  const configured = configuredEnvironment?.trim();
  if (configured) {
    return configured;
  }

  return mode.startsWith("production") ? "production" : "development";
}

export type SentryDistribution = "store" | "unpacked" | "unknown";

export function resolveSentryDistribution(
  runtimeId: string | undefined,
  storeExtensionId: string,
): SentryDistribution {
  const normalizedRuntimeId = runtimeId?.trim();
  if (!normalizedRuntimeId) {
    return "unknown";
  }

  return normalizedRuntimeId === storeExtensionId ? "store" : "unpacked";
}
