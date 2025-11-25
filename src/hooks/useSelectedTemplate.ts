/**
 * useSelectedTemplate
 * Manages the selected template for the LinkGroup display
 * Stores selection in Chrome Extension Storage
 */

import { useState, useEffect } from 'react';
import { getTemplate } from '@/apis/templates';
import type { Template } from '@/types/api';
import { LinkList, LinkListElement } from '@/constants/LinkList';
import { loadTemplateFromLocalStorage } from '@/utils/templateStorage';

const STORAGE_KEY = 'selectedTemplateId';

/**
 * Convert Template to LinkListElement[] format
 */
function convertTemplateToLinkList(template: Template): LinkListElement[] {
  return template.items.map((item) => ({
    icon: item.icon.imageUrl,
    label: item.name,
    link: item.siteUrl,
    type: 'png' as const,
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templateData, setTemplateData] = useState<Template | null>(null);
  const [linkItems, setLinkItems] = useState<LinkListElement[]>(LinkList);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load selected template ID from Chrome storage on mount
  useEffect(() => {
    loadSelectedTemplate();
  }, []);

  // Listen for storage changes from other contexts (real-time sync)
  useEffect(() => {
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        const newValue = changes[STORAGE_KEY].newValue;
        console.log('[useSelectedTemplate] Storage changed:', {
          raw: newValue,
          type: typeof newValue,
        });
        // 0 값도 null로 변환 (기본 템플릿)
        const normalizedValue = newValue === 0 || newValue === undefined ? null : newValue;
        console.log('[useSelectedTemplate] Normalized value:', normalizedValue);
        setSelectedTemplateId(normalizedValue);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }, []);

  // Load template data when selectedTemplateId changes
  useEffect(() => {
    if (selectedTemplateId) {
      loadTemplateData(selectedTemplateId);
    } else {
      // No template selected - use default LinkList
      setTemplateData(null);
      setLinkItems(LinkList);
      setIsLoading(false);
    }
  }, [selectedTemplateId]);

  const loadSelectedTemplate = async () => {
    setIsLoading(true);
    try {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      const templateId = result[STORAGE_KEY];

      console.log('[useSelectedTemplate] Loaded from storage:', {
        raw: templateId,
        type: typeof templateId,
      });

      if (templateId === 0) {
        // templateId가 0이면 기본 템플릿 → null로 변환
        console.log('[useSelectedTemplate] Converting 0 to null (default template)');
        setSelectedTemplateId(null);
        setLinkItems(LinkList);
      } else if (templateId && typeof templateId === 'number') {
        console.log('[useSelectedTemplate] Setting templateId:', templateId);
        setSelectedTemplateId(templateId);
      } else {
        // No template selected - use default
        console.log('[useSelectedTemplate] No template selected, using default');
        setSelectedTemplateId(null);
        setLinkItems(LinkList);
      }
    } catch (err) {
      console.error('Failed to load selected template:', err);
      setError('템플릿을 불러오는데 실패했습니다.');
      setLinkItems(LinkList);
      setSelectedTemplateId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplateData = async (templateId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      // Try loading from localStorage first (for local-only templates)
      const localData = loadTemplateFromLocalStorage(templateId);
      if (localData) {
        console.log('[useSelectedTemplate] Loaded template from localStorage:', templateId);
        setTemplateData(localData.template);
        setLinkItems(convertTemplateToLinkList(localData.template));
        setIsLoading(false);
        return;
      }

      // Fallback: Load from server
      const result = await getTemplate(templateId);

      if (result.success && result.data) {
        console.log('[useSelectedTemplate] Loaded template from server:', templateId);
        setTemplateData(result.data);
        setLinkItems(convertTemplateToLinkList(result.data));
      } else {
        // Failed to load template - fallback to default
        console.error('Failed to load template:', result.error);
        setError(result.error?.message || '템플릿을 불러올 수 없습니다.');
        setSelectedTemplateId(null);
        setLinkItems(LinkList);
      }
    } catch (err) {
      console.error('Error loading template:', err);
      setError('템플릿 로딩 중 오류가 발생했습니다.');
      setSelectedTemplateId(null);
      setLinkItems(LinkList);
    } finally {
      setIsLoading(false);
    }
  };

  const selectTemplate = async (templateId: number | null) => {
    try {
      if (templateId === null) {
        // Clear selection
        await chrome.storage.local.remove(STORAGE_KEY);
        setSelectedTemplateId(null);
        setTemplateData(null);
        setLinkItems(LinkList);
      } else {
        // Save selection
        await chrome.storage.local.set({ [STORAGE_KEY]: templateId });
        setSelectedTemplateId(templateId);
      }
    } catch (err) {
      console.error('Failed to save template selection:', err);
      setError('템플릿 선택을 저장하는데 실패했습니다.');
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
