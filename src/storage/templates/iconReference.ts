import type { Icon, TemplateIcon } from "@/types/api";

export function isRemoteHttpIconUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

function isLocalBundledIconUrl(value: string): boolean {
  if (value.startsWith("data:image/svg+xml,")) return true;

  try {
    return new URL(value, "chrome-extension://linku.invalid").protocol ===
      "chrome-extension:";
  } catch {
    return false;
  }
}

/**
 * Resolves a bundled icon without trusting its array-position id.
 *
 * Asset filenames and numeric positions can change between extension builds.
 * A local bundled reference may therefore fall back to its stable icon name,
 * while remote and portable user images are never rewritten by name alone.
 */
export function resolveBundledIconReference(
  reference: TemplateIcon,
  bundledIcons: readonly Icon[],
): Icon | undefined {
  const exactImage = bundledIcons.find(
    (icon) => icon.imageUrl === reference.iconUrl,
  );
  if (exactImage) return exactImage;

  if (!isLocalBundledIconUrl(reference.iconUrl)) return undefined;
  return bundledIcons.find((icon) => icon.name === reference.iconName);
}
