import type { ComponentProps } from "react";
import { GENERIC_LINK_ICON_URL } from "@/constants/templateIcons";

/**
 * Displays a template icon without mutating the stored source when an older
 * remote icon is temporarily unavailable. Keeping the fallback at render time
 * preserves the only URL a legacy user may have while the editor remains
 * usable offline.
 */
export function TemplateIconImage({
  onError,
  ...props
}: ComponentProps<"img">) {
  return (
    <img
      {...props}
      onError={(event) => {
        onError?.(event);
        if (event.currentTarget.getAttribute("src") !== GENERIC_LINK_ICON_URL) {
          event.currentTarget.src = GENERIC_LINK_ICON_URL;
        }
      }}
    />
  );
}
