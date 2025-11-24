/**
 * useSelectedTemplate
 * Manages the selected template for the LinkGroup display
 * Stores selection in Chrome Extension Storage
 */

import { useState, useEffect } from 'react';
import { getTemplate } from '@/apis/templates';
import type { Template } from '@/types/api';
import { LinkList, LinkListElement } from '@/constants/LinkList';

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

      if (templateId && typeof templateId === 'number') {
        setSelectedTemplateId(templateId);
      } else {
        // No template selected - use default
        setSelectedTemplateId(null);
        setLinkItems(LinkList);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Failed to load selected template:', err);
      setError('템플릿을 불러오는데 실패했습니다.');
      setLinkItems(LinkList);
      setIsLoading(false);
    }
  };

  const loadTemplateData = async (templateId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await getTemplate(templateId);

      if (result.success && result.data) {
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
