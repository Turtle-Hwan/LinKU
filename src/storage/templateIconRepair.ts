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

export interface TemplateIconRegistrationFailure {
  area: "template" | "staging";
  itemIndex: number;
  itemName: string;
  error: unknown;
}

export interface TemplateIconRepairResult {
  stored: StoredTemplate;
  changed: boolean;
  registrationFailures: TemplateIconRegistrationFailure[];
}

interface TemplateIconRepairDependencies {
  getAssetByNumericId: typeof getAssetByNumericId;
  saveAssetFromDataUrl: typeof saveAssetFromDataUrl;
}

/**
 * Re-registers inline images and updates stale bundled references so every
 * stored item remains editable without replacing legacy remote images.
 */
export async function repairTemplateIcons(
  stored: StoredTemplate,
  dependencies: Partial<TemplateIconRepairDependencies> = {},
): Promise<TemplateIconRepairResult> {
  let changed = false;
  const registrationFailures: TemplateIconRegistrationFailure[] = [];
  const loadAsset = dependencies.getAssetByNumericId ?? getAssetByNumericId;
  const saveAsset =
    dependencies.saveAssetFromDataUrl ?? saveAssetFromDataUrl;
  const bundledIcons = getBundledTemplateIcons();
  const fallbackIcon = bundledIcons.find(
    (icon) => icon.name === GENERIC_LINK_ICON_NAME,
  );
  if (!fallbackIcon) {
    throw new Error("기본 링크 아이콘을 찾을 수 없습니다.");
  }

  const repairItems = async (
    items: TemplateItem[],
    area: TemplateIconRegistrationFailure["area"],
  ): Promise<TemplateItem[]> => {
    const repaired: TemplateItem[] = [];
    for (const [itemIndex, item] of items.entries()) {
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
        const existing = await loadAsset(iconId);
        if (existing?.dataUrl === iconUrl) {
          repaired.push(item);
          continue;
        }
      }

      try {
        const asset = await saveAsset(iconName || item.name, iconUrl);
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
        registrationFailures.push({
          area,
          itemIndex,
          itemName: item.name,
          error,
        });
        // This inline image may be the user's only copy. A fallback is useful
        // for rendering, but persisting one here would destroy the recoverable
        // original after a transient storage or browser failure.
        repaired.push(item);
      }
    }
    return repaired;
  };

  const template = {
    ...stored.template,
    items: await repairItems(stored.template.items, "template"),
  };
  const stagingItems = await repairItems(stored.stagingItems, "staging");

  return {
    stored: changed ? { ...stored, template, stagingItems } : stored,
    changed,
    registrationFailures,
  };
}
