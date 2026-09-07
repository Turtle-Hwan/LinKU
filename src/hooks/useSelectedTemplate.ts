/**
 * useSelectedTemplate
 * Manages the selected template for the LinkGroup display
 * Stores selection in Chrome Extension Storage
 */

import { useEffect, useRef, useState } from "react";
import {
  resolveLatestBulletin,
  subscribeLatestBulletin,
} from "@/apis/external/bulletin";
import type { Template } from "@/types/api";
import {
  LinkList,
  createDefaultLinkList,
  type LinkListElement,
} from "@/constants/LinkList";
import type { BulletinInfo } from "@/constants/bulletin";
import { getLocalTemplate } from "@/storage/templates/repository";
import { debugLog, captureErrorLog } from '@/utils/logger';
import { UNSAVED_TEMPLATE_ID } from '@/constants/template';

const STORAGE_KEY = "selectedTemplateId";

function getChromeStorage() {
  return globalThis.chrome?.storage;
}

/**
 * Convert Template to LinkListElement[] format
 */
function convertTemplateToLinkList(template: Template): LinkListElement[] {
  return template.items.map((item) => ({
    icon: item.icon.iconUrl,
    label: item.name,
    link: item.siteUrl,
    type: "png" as const,
    islong: item.size.width > 2, // Items wider than 2 columns span 3 columns
    iconColor: undefined,
  }));
}

interface UseSelectedTemplateResult {
  selectedTemplateId: number | null;
  templateData: Template | null;
  linkItems: LinkListElement[];
  isLoading: boolean;
  error: string | null;
  selectTemplate: (templateId: number | null) => Promise<boolean>;
}

export function useSelectedTemplate(): UseSelectedTemplateResult {
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(
    null,
  );
  const [templateData, setTemplateData] = useState<Template | null>(null);
  const [linkItems, setLinkItems] = useState<LinkListElement[]>(LinkList);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedSelection, setHasLoadedSelection] = useState(false);
  const loadRequestIdRef = useRef(0);
  const selectedTemplateIdRef = useRef<number | null>(selectedTemplateId);
  const defaultLinkItemsRef = useRef<LinkListElement[]>(LinkList);
  const bulletinYearRef = useRef(0);

  selectedTemplateIdRef.current = selectedTemplateId;

  // Load selected template ID from Chrome storage on mount
  useEffect(() => {
    loadSelectedTemplate();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyBulletin = (bulletin: BulletinInfo) => {
      if (cancelled || bulletin.year < bulletinYearRef.current) {
        return;
      }

      bulletinYearRef.current = bulletin.year;
      const resolvedLinkItems = createDefaultLinkList(bulletin);
      defaultLinkItemsRef.current = resolvedLinkItems;

      if (selectedTemplateIdRef.current === null) {
        setLinkItems(resolvedLinkItems);
      }
    };
    const unsubscribe = subscribeLatestBulletin(applyBulletin);

    void resolveLatestBulletin().then(applyBulletin);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Listen for storage changes from other contexts (real-time sync)
  useEffect(() => {
    const storage = getChromeStorage();
    if (!storage?.onChanged) {
      return;
    }

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName === "local" && changes[STORAGE_KEY]) {
        const newValue = changes[STORAGE_KEY].newValue;
        debugLog("[useSelectedTemplate] Storage changed:", {
          raw: newValue,
          type: typeof newValue,
        });
        // 0 값, undefined, 숫자가 아닌 값은 null로 변환 (기본 템플릿)
        const normalizedValue =
          newValue === 0 || typeof newValue !== "number" ? null : newValue;
        debugLog("[useSelectedTemplate] Normalized value:", normalizedValue);

        if (normalizedValue === selectedTemplateIdRef.current) {
          return;
        }

        if (normalizedValue === null) {
          loadRequestIdRef.current += 1;
          setSelectedTemplateId(null);
          setTemplateData(null);
          setLinkItems(defaultLinkItemsRef.current);
          setError(null);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setError(null);
        setTemplateData(null);
        setSelectedTemplateId(normalizedValue);
      }
    };

    storage.onChanged.addListener(listener);
    return () => {
      storage.onChanged.removeListener(listener);
    };
  }, []);

  // Load template data when selectedTemplateId changes
  useEffect(() => {
    if (!hasLoadedSelection) {
      return;
    }

    const requestId = ++loadRequestIdRef.current;

    if (selectedTemplateId) {
      void loadTemplateData(selectedTemplateId, requestId);
    } else {
      // No template selected - use default LinkList
      setTemplateData(null);
      setLinkItems(defaultLinkItemsRef.current);
      setIsLoading(false);
    }
  }, [hasLoadedSelection, selectedTemplateId]);

  const loadSelectedTemplate = async () => {
    setIsLoading(true);
    try {
      const storage = getChromeStorage();
      if (!storage?.local) {
        setSelectedTemplateId(null);
        setLinkItems(defaultLinkItemsRef.current);
        return;
      }

      const result = await storage.local.get([STORAGE_KEY]);
      const templateId = result[STORAGE_KEY];

      debugLog("[useSelectedTemplate] Loaded from storage:", {
        raw: templateId,
        type: typeof templateId,
      });

      if (templateId === UNSAVED_TEMPLATE_ID) {
        // templateId가 0이면 기본 템플릿 → null로 변환
        debugLog(
          "[useSelectedTemplate] Converting 0 to null (default template)",
        );
        setSelectedTemplateId(null);
        setLinkItems(defaultLinkItemsRef.current);
      } else if (templateId && typeof templateId === "number") {
        debugLog("[useSelectedTemplate] Setting templateId:", templateId);
        setSelectedTemplateId(templateId);
      } else {
        // No template selected - use default
        debugLog(
          "[useSelectedTemplate] No template selected, using default",
        );
        setSelectedTemplateId(null);
        setLinkItems(defaultLinkItemsRef.current);
      }
    } catch (err) {
      captureErrorLog("Failed to load selected template:", err);
      setError("템플릿을 불러오는데 실패했습니다.");
      setLinkItems(defaultLinkItemsRef.current);
      setSelectedTemplateId(null);
    } finally {
      setHasLoadedSelection(true);
    }
  };

  const loadTemplateData = async (templateId: number, requestId: number) => {
    setIsLoading(true);
    setError(null);
    const isStaleRequest = () => requestId !== loadRequestIdRef.current;

    try {
      // Try loading from IndexedDB first (for local-only templates)
      const localData = await getLocalTemplate(templateId);
      if (isStaleRequest()) {
        return;
      }

      if (localData) {
        debugLog(
          "[useSelectedTemplate] Loaded template from IndexedDB:",
          templateId,
        );
        setTemplateData(localData.template);
        setLinkItems(convertTemplateToLinkList(localData.template));
        setIsLoading(false);
        return;
      }

      const storage = getChromeStorage();
      if (storage?.local) {
        try {
          await storage.local.remove(STORAGE_KEY);
        } catch (storageError) {
          captureErrorLog("Failed to clear a missing template selection:", storageError);
        }
      }
      if (isStaleRequest()) {
        return;
      }

      setError("이 기기에서 템플릿을 찾을 수 없어 기본 템플릿을 표시합니다.");
      setTemplateData(null);
      setSelectedTemplateId(null);
      setLinkItems(defaultLinkItemsRef.current);
    } catch (err) {
      if (isStaleRequest()) {
        return;
      }

      captureErrorLog("Error loading template:", err);
      setError("템플릿 로딩 중 오류가 발생했습니다.");
      setTemplateData(null);
      setSelectedTemplateId(null);
      setLinkItems(defaultLinkItemsRef.current);
    } finally {
      if (!isStaleRequest()) {
        setIsLoading(false);
      }
    }
  };

  const selectTemplate = async (templateId: number | null): Promise<boolean> => {
    try {
      const storage = getChromeStorage();
      if (!storage?.local) {
        if (templateId !== null && templateId === selectedTemplateIdRef.current) {
          return true;
        }

        if (templateId === null) {
          loadRequestIdRef.current += 1;
          setSelectedTemplateId(null);
          setTemplateData(null);
          setLinkItems(defaultLinkItemsRef.current);
          setError(null);
          setIsLoading(false);
        } else {
          setIsLoading(true);
          setError(null);
          setTemplateData(null);
          setSelectedTemplateId(templateId);
        }
        return true;
      }

      if (templateId === null) {
        // Clear selection
        loadRequestIdRef.current += 1;
        await storage.local.remove(STORAGE_KEY);
        setSelectedTemplateId(null);
        setTemplateData(null);
        setLinkItems(defaultLinkItemsRef.current);
        setError(null);
        setIsLoading(false);
      } else {
        if (templateId === selectedTemplateIdRef.current) {
          return true;
        }

        // Save selection
        setIsLoading(true);
        setError(null);
        setTemplateData(null);
        await storage.local.set({ [STORAGE_KEY]: templateId });
        setSelectedTemplateId(templateId);
      }
      return true;
    } catch (err) {
      captureErrorLog("Failed to save template selection:", err);
      setError("템플릿 선택을 저장하는데 실패했습니다.");
      setIsLoading(false);
      return false;
    }
  };

  return {
    selectedTemplateId,
    templateData,
    linkItems,
    isLoading,
    error,
    selectTemplate,
  };
}
