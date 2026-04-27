/**
 * useSelectedTemplate
 * Manages the selected template for the LinkGroup display
 * Stores selection in Chrome Extension Storage
 */

import { useEffect, useRef, useState } from "react";
import { getTemplate } from "@/apis/templates";
import type { Template } from "@/types/api";
import { LinkList, LinkListElement } from "@/constants/LinkList";
import { loadTemplateFromLocalStorage } from "@/utils/templateStorage";
import { debugLog, errorLog } from '@/utils/logger';

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
  selectTemplate: (templateId: number | null) => Promise<void>;
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

  selectedTemplateIdRef.current = selectedTemplateId;

  // Load selected template ID from Chrome storage on mount
  useEffect(() => {
    loadSelectedTemplate();
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
          setLinkItems(LinkList);
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
      setLinkItems(LinkList);
      setIsLoading(false);
    }
  }, [hasLoadedSelection, selectedTemplateId]);

  const loadSelectedTemplate = async () => {
    setIsLoading(true);
    try {
      const storage = getChromeStorage();
      if (!storage?.local) {
        setSelectedTemplateId(null);
        setLinkItems(LinkList);
        return;
      }

      const result = await storage.local.get([STORAGE_KEY]);
      const templateId = result[STORAGE_KEY];

      debugLog("[useSelectedTemplate] Loaded from storage:", {
        raw: templateId,
        type: typeof templateId,
      });

      if (templateId === 0) {
        // templateId가 0이면 기본 템플릿 → null로 변환
        debugLog(
          "[useSelectedTemplate] Converting 0 to null (default template)",
        );
        setSelectedTemplateId(null);
        setLinkItems(LinkList);
      } else if (templateId && typeof templateId === "number") {
        debugLog("[useSelectedTemplate] Setting templateId:", templateId);
        setSelectedTemplateId(templateId);
      } else {
        // No template selected - use default
        debugLog(
          "[useSelectedTemplate] No template selected, using default",
        );
        setSelectedTemplateId(null);
        setLinkItems(LinkList);
      }
    } catch (err) {
      errorLog("Failed to load selected template:", err);
      setError("템플릿을 불러오는데 실패했습니다.");
      setLinkItems(LinkList);
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
      // Try loading from localStorage first (for local-only templates)
      const localData = loadTemplateFromLocalStorage(templateId);
      if (localData) {
        if (isStaleRequest()) {
          return;
        }

        debugLog(
          "[useSelectedTemplate] Loaded template from localStorage:",
          templateId,
        );
        setTemplateData(localData.template);
        setLinkItems(convertTemplateToLinkList(localData.template));
        setIsLoading(false);
        return;
      }

      // Fallback: Load from server
      const result = await getTemplate(templateId);

      if (isStaleRequest()) {
        return;
      }

      if (result.success && result.data) {
        debugLog(
          "[useSelectedTemplate] Loaded template from server:",
          templateId,
        );
        setTemplateData(result.data);
        setLinkItems(convertTemplateToLinkList(result.data));
      } else {
        // Failed to load template - fallback to default
        errorLog("Failed to load template:", result.error);
        setError(result.error?.message || "템플릿을 불러올 수 없습니다.");
        setTemplateData(null);
        setSelectedTemplateId(null);
        setLinkItems(LinkList);
      }
    } catch (err) {
      if (isStaleRequest()) {
        return;
      }

      errorLog("Error loading template:", err);
      setError("템플릿 로딩 중 오류가 발생했습니다.");
      setTemplateData(null);
      setSelectedTemplateId(null);
      setLinkItems(LinkList);
    } finally {
      if (!isStaleRequest()) {
        setIsLoading(false);
      }
    }
  };

  const selectTemplate = async (templateId: number | null) => {
    try {
      const storage = getChromeStorage();
      if (!storage?.local) {
        if (templateId !== null && templateId === selectedTemplateIdRef.current) {
          return;
        }

        if (templateId === null) {
          loadRequestIdRef.current += 1;
          setSelectedTemplateId(null);
          setTemplateData(null);
          setLinkItems(LinkList);
          setError(null);
          setIsLoading(false);
        } else {
          setIsLoading(true);
          setError(null);
          setTemplateData(null);
          setSelectedTemplateId(templateId);
        }
        return;
      }

      if (templateId === null) {
        // Clear selection
        loadRequestIdRef.current += 1;
        await storage.local.remove(STORAGE_KEY);
        setSelectedTemplateId(null);
        setTemplateData(null);
        setLinkItems(LinkList);
        setError(null);
        setIsLoading(false);
      } else {
        if (templateId === selectedTemplateIdRef.current) {
          return;
        }

        // Save selection
        setIsLoading(true);
        setError(null);
        setTemplateData(null);
        await storage.local.set({ [STORAGE_KEY]: templateId });
        setSelectedTemplateId(templateId);
      }
    } catch (err) {
      errorLog("Failed to save template selection:", err);
      setError("템플릿 선택을 저장하는데 실패했습니다.");
      setIsLoading(false);
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
