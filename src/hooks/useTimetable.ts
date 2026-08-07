import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  TIMETABLE_STORAGE_KEYS,
  type ResolvedTimetableAsset,
  type TimetableAssetMeta,
  type TimetableImportMode,
} from "@/types/timetable";
import { importTimetableFromEverytime } from "@/utils/timetableImport";
import {
  deleteActiveTimetable,
  getActiveTimetable,
  getTimetableAssets,
  saveTimetableAsset,
  setActiveTimetable,
} from "@/utils/timetableStorage";
import { getErrorLogDetails, warnLog } from "@/utils/logger";
import { readTimetableImage } from "@/components/Tabs/TimeTable/timetableImage";

export type TimetableBusyState =
  | "loading"
  | "uploading"
  | "importing"
  | "deleting"
  | null;

export function useTimetable() {
  const [asset, setAsset] = useState<ResolvedTimetableAsset | null>(null);
  const [assets, setAssets] = useState<TimetableAssetMeta[]>([]);
  const [busy, setBusy] = useState<TimetableBusyState>("loading");

  const loadTimetable = useCallback(async () => {
    try {
      const [storedAsset, storedAssets] = await Promise.all([
        getActiveTimetable(),
        getTimetableAssets(),
      ]);
      setAsset(storedAsset);
      setAssets(storedAssets);
    } catch (error) {
      warnLog("[Timetable] Failed to load saved timetable", getErrorLogDetails(error));
      toast.error("저장된 시간표를 불러오지 못했습니다.");
    } finally {
      setBusy((current) => (current === "loading" ? null : current));
    }
  }, []);

  useEffect(() => {
    void loadTimetable();

    if (
      typeof chrome === "undefined" ||
      !chrome.runtime?.id ||
      !chrome.storage?.onChanged
    ) {
      return;
    }

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (
        areaName === "local" &&
        (changes[TIMETABLE_STORAGE_KEYS.assetIndex] ||
          changes[TIMETABLE_STORAGE_KEYS.everytimeOverrides])
      ) {
        void loadTimetable();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [loadTimetable]);

  const saveUploadedFile = useCallback(
    async (file: File) => {
      setBusy("uploading");

      try {
        const image = await readTimetableImage(file);
        const result = await saveTimetableAsset(image.blob, {
          source: "upload",
          width: image.width,
          height: image.height,
        });

        await loadTimetable();
        toast.success(
          result.changed
            ? "시간표를 이 브라우저에 저장했어요."
            : "이미 저장된 시간표와 같은 이미지예요.",
        );
      } catch (error) {
        warnLog("[Timetable] Image upload failed", getErrorLogDetails(error));
        toast.error(
          error instanceof Error
            ? error.message
            : "시간표 이미지를 저장하지 못했습니다.",
        );
      } finally {
        setBusy(null);
      }
    },
    [loadTimetable],
  );

  const importFromEverytime = useCallback(async (mode: TimetableImportMode) => {
    setBusy("importing");

    try {
      const result = await importTimetableFromEverytime(mode);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      await loadTimetable();
      const periodLabel = mode === "latest" ? "최근 4학기" : "이전 4학기";
      toast.success(
        result.importedCount === 0
          ? `${periodLabel}에 수업이 있는 시간표를 찾지 못했어요.`
          : result.updatedCount > 0
            ? `${periodLabel} ${result.importedCount}개 학기 시간표를 가져왔어요.`
            : `${periodLabel} 시간표가 이미 최신 상태예요.`,
      );
    } catch (error) {
      warnLog(
        "[Timetable] Everytime import request failed",
        getErrorLogDetails(error),
      );
      toast.error(
        error instanceof Error
          ? error.message
          : "에브리타임 시간표를 가져오지 못했습니다.",
      );
    } finally {
      setBusy(null);
    }
  }, [loadTimetable]);

  const importLatestEverytime = useCallback(
    () => importFromEverytime("latest"),
    [importFromEverytime],
  );

  const importPreviousEverytimeSemesters = useCallback(
    () => importFromEverytime("previous"),
    [importFromEverytime],
  );

  const deleteTimetable = useCallback(async () => {
    setBusy("deleting");

    try {
      await deleteActiveTimetable();
      await loadTimetable();
      toast.success("저장된 시간표를 삭제했어요.");
      return true;
    } catch (error) {
      warnLog("[Timetable] Delete failed", getErrorLogDetails(error));
      toast.error("시간표를 삭제하지 못했습니다.");
      return false;
    } finally {
      setBusy(null);
    }
  }, [loadTimetable]);

  const selectTimetable = useCallback(
    async (id: string) => {
      if (asset?.meta.id === id) {
        return;
      }

      setBusy("loading");
      try {
        await setActiveTimetable(id);
        await loadTimetable();
      } catch (error) {
        warnLog("[Timetable] Failed to select timetable", getErrorLogDetails(error));
        toast.error("시간표를 전환하지 못했습니다.");
      } finally {
        setBusy(null);
      }
    },
    [asset?.meta.id, loadTimetable],
  );

  return {
    asset,
    assets,
    busy,
    saveUploadedFile,
    importLatestEverytime,
    importPreviousEverytimeSemesters,
    deleteTimetable,
    selectTimetable,
  };
}
