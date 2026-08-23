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
