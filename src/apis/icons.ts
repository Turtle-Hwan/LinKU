/**
 * Frontend-owned icon repository.
 * Bundled icons and custom IndexedDB assets keep the editor usable offline.
 */

import { getBundledTemplateIcons } from "@/constants/templateIcons";
import {
  deleteAsset,
  listAssets,
  renameAsset,
  saveAsset,
} from "@/storage/assetRepository";
import { countTemplateItemsUsingIcon } from "@/utils/templateStorage";
import type {
  ApiResponse,
  CreateIconResponse,
  DeleteResponse,
  Icon,
} from "@/types/api";

export async function createIcon(
  iconName: string,
  iconFile: File | Blob,
): Promise<ApiResponse<CreateIconResponse>> {
  try {
    const asset = await saveAsset(iconName, iconFile);
    return {
      success: true,
      data: { id: asset.numericId, name: asset.name, imageUrl: asset.dataUrl },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "ICON_STORAGE_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "아이콘을 저장하지 못했습니다.",
      },
    };
  }
}

export async function getDefaultIcons(): Promise<ApiResponse<Icon[]>> {
  return { success: true, data: getBundledTemplateIcons() };
}

export async function getMyIcons(): Promise<ApiResponse<Icon[]>> {
  const assets = await listAssets();
  return {
    success: true,
    data: assets.map((asset) => ({
      id: asset.numericId,
      name: asset.name,
      imageUrl: asset.dataUrl,
      isDefault: false,
      createdAt: new Date(asset.createdAt).toISOString(),
    })),
  };
}

export async function renameIcon(
  iconId: number,
  newName: string,
): Promise<ApiResponse<Icon>> {
  try {
    const assets = await listAssets();
    const asset = assets.find((candidate) => candidate.numericId === iconId);
    if (!asset) {
      return {
        success: false,
        error: { code: "ICON_NOT_FOUND", message: "아이콘을 찾을 수 없습니다." },
      };
    }
    const renamed = await renameAsset(asset.id, newName);
    return {
      success: true,
      data: {
        id: renamed.numericId,
        name: renamed.name,
        imageUrl: renamed.dataUrl,
        isDefault: false,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "ICON_STORAGE_ERROR",
        message: error instanceof Error ? error.message : "아이콘 이름을 바꾸지 못했습니다.",
      },
    };
  }
}

export async function deleteIcon(
  iconId: number,
): Promise<ApiResponse<DeleteResponse>> {
  const assets = await listAssets();
  const asset = assets.find((candidate) => candidate.numericId === iconId);
  if (!asset) {
    return {
      success: false,
      error: { code: "ICON_NOT_FOUND", message: "아이콘을 찾을 수 없습니다." },
    };
  }
  // Templates keep the icon image inline, so a deleted asset still renders —
  // but the editor resolves icons by id, and an item pointing at a missing one
  // can no longer be saved. Deleting a referenced icon is refused instead of
  // leaving those items uneditable.
  const usageCount = await countTemplateItemsUsingIcon(iconId);
  if (usageCount > 0) {
    return {
      success: false,
      error: {
        code: "ICON_IN_USE",
        message: `이 아이콘을 사용하는 항목이 ${usageCount}개 있어 삭제할 수 없습니다.`,
      },
    };
  }

  await deleteAsset(asset.id);
  return { success: true, data: { message: "아이콘을 삭제했습니다." } };
}
