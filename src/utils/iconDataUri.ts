import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LucideIcon } from "lucide-react";

const FALLBACK_ICON_DATA_URI =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIvPjwvc3ZnPg==";

/** Converts a bundled Lucide component into a self-contained SVG data URI. */
export function convertLucideIconToDataUri(
  IconComponent: LucideIcon,
  color = "#00913a",
): string {
  try {
    const svg = renderToStaticMarkup(
      createElement(IconComponent, { size: 24, color, strokeWidth: 2 }),
    );
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  } catch {
    // This utility is also used by the no-network Pages viewer. A deterministic
    // visual fallback keeps it independent from monitoring and other runtimes.
    return FALLBACK_ICON_DATA_URI;
  }
}
