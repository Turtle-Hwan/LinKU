import {
  getAssetByNumericId,
  saveAssetFromDataUrl,
} from "@/storage/assetRepository";
import {
  isRemoteHttpIconUrl,
  resolveBundledIconReference,
} from "@/storage/iconReference";
import type { StoredTemplate } from "@/storage/linkuDb";
import { PORTABLE_ICON_PATTERN } from "@/constants/template";
import {
  GENERIC_LINK_ICON_NAME,
  getBundledTemplateIcons,
} from "@/constants/templateIcons";
import type { TemplateItem } from "@/types/api";
import { errorLog } from "@/utils/logger";

/**
 * Re-registers inline images and updates stale bundled references so every
 * stored item remains editable without replacing legacy remote images.
 */
export async function repairTemplateIcons(
  stored: StoredTemplate,
): Promise<{ stored: StoredTemplate; changed: boolean }> {
  let changed = false;
  const bundledIcons = getBundledTemplateIcons();
  const fallbackIcon = bundledIcons.find(
    (icon) => icon.name === GENERIC_LINK_ICON_NAME,
  );
  if (!fallbackIcon) {
    throw new Error("기본 링크 아이콘을 찾을 수 없습니다.");
  }

  const repairItems = async (items: TemplateItem[]): Promise<TemplateItem[]> => {
    const repaired: TemplateItem[] = [];
    for (const item of items) {
      const { iconId, iconUrl, iconName } = item.icon;
      const bundledIcon = resolveBundledIconReference(item.icon, bundledIcons);
      if (bundledIcon) {
        if (
          bundledIcon.id === iconId &&
          bundledIcon.name === iconName &&
          bundledIcon.imageUrl === iconUrl
        ) {
          repaired.push(item);
          continue;
        }
        changed = true;
        repaired.push({
          ...item,
          icon: {
            iconId: bundledIcon.id,
            iconName: bundledIcon.name,
            iconUrl: bundledIcon.imageUrl,
          },
        });
        continue;
      }

      // Earlier versions stored backend-uploaded icons as remote URLs. The
      // renderer supplies a visual fallback, but the only original reference
      // stays intact for later recovery.
      if (!PORTABLE_ICON_PATTERN.test(iconUrl)) {
        if (isRemoteHttpIconUrl(iconUrl) && iconId > 0) {
          repaired.push(item);
          continue;
        }

        changed = true;
        repaired.push({
          ...item,
          icon: {
            iconId: fallbackIcon.id,
            iconName: fallbackIcon.name,
            iconUrl: fallbackIcon.imageUrl,
          },
        });
        continue;
      }

      if (iconId > 0) {
        const existing = await getAssetByNumericId(iconId);
        if (existing?.dataUrl === iconUrl) {
          repaired.push(item);
          continue;
        }
      }

      try {
        const asset = await saveAssetFromDataUrl(iconName || item.name, iconUrl);
        changed = true;
        repaired.push({
          ...item,
          icon: {
            iconId: asset.numericId,
            iconName: asset.name,
            iconUrl: asset.dataUrl,
          },
        });
      } catch (error) {
        errorLog("Failed to register an inline template icon", error);
        changed = true;
        repaired.push({
          ...item,
          icon: {
            iconId: fallbackIcon.id,
            iconName: fallbackIcon.name,
            iconUrl: fallbackIcon.imageUrl,
          },
        });
      }
    }
    return repaired;
  };

  const template = {
    ...stored.template,
    items: await repairItems(stored.template.items),
  };
  const stagingItems = await repairItems(stored.stagingItems);

  return changed
    ? { stored: { ...stored, template, stagingItems }, changed }
    : { stored, changed };
}
