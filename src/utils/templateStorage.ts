/**
 * Template LocalStorage Management
 * Handles saving and loading templates to/from browser's localStorage
 */

import type { Template, TemplateItem } from '@/types/api';

export interface StoredTemplate {
  template: Template;
  stagingItems: TemplateItem[];
  metadata: {
    lastSaved: number;
    savedLocally: boolean;
    syncedWithServer: boolean;
    serverSyncedAt?: number;
  };
}

export interface TemplateIndexEntry {
  templateId: number;
  name: string;
  lastSaved: number;
  syncedWithServer: boolean;
}

const STORAGE_PREFIX = 'linku_template_';
const INDEX_KEY = 'linku_templates_index';
const DRAFT_KEY = 'linku_template_draft';

/**
 * Save template to localStorage
 */
export async function saveTemplateToLocalStorage(
  template: Template,
  stagingItems: TemplateItem[] = [],
  syncedWithServer = false
): Promise<void> {
  try {
    const stored: StoredTemplate = {
      template,
      stagingItems,
      metadata: {
        lastSaved: Date.now(),
        savedLocally: true,
        syncedWithServer,
        serverSyncedAt: syncedWithServer ? Date.now() : undefined,
      },
    };

    // Save template data
    const key =
      template.templateId === 0
        ? DRAFT_KEY
        : `${STORAGE_PREFIX}${template.templateId}`;

    localStorage.setItem(key, JSON.stringify(stored));

    // Update index
    await updateTemplateIndex(template, syncedWithServer);
  } catch (error) {
    console.error('Failed to save template to localStorage:', error);
    throw new Error('LocalStorage 저장 실패');
  }
}

/**
 * Load template from localStorage
 */
export function loadTemplateFromLocalStorage(
  templateId: number
): StoredTemplate | null {
  try {
    const key =
      templateId === 0 ? DRAFT_KEY : `${STORAGE_PREFIX}${templateId}`;

    const data = localStorage.getItem(key);
    if (!data) return null;

    return JSON.parse(data) as StoredTemplate;
  } catch (error) {
    console.error('Failed to load template from localStorage:', error);
    return null;
  }
}

/**
 * Update template index
 */
async function updateTemplateIndex(
  template: Template,
  syncedWithServer: boolean
): Promise<void> {
  try {
    const indexData = localStorage.getItem(INDEX_KEY);
    const index: TemplateIndexEntry[] = indexData ? JSON.parse(indexData) : [];

    // Find existing entry or create new
    const existingIndex = index.findIndex(
      (t) => t.templateId === template.templateId
    );

    const entry: TemplateIndexEntry = {
      templateId: template.templateId,
      name: template.name,
      lastSaved: Date.now(),
      syncedWithServer,
    };

    if (existingIndex >= 0) {
      index[existingIndex] = entry;
    } else {
      index.push(entry);
    }

    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    console.error('Failed to update template index:', error);
  }
}

/**
 * Get all templates index
 */
export function getTemplatesIndex(): TemplateIndexEntry[] {
  try {
    const data = localStorage.getItem(INDEX_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load templates index:', error);
    return [];
  }
}

/**
 * Delete template from localStorage
 */
export function deleteTemplateFromLocalStorage(templateId: number): void {
  try {
    const key = `${STORAGE_PREFIX}${templateId}`;
    localStorage.removeItem(key);

    // Update index
    const indexData = localStorage.getItem(INDEX_KEY);
    if (indexData) {
      const index: TemplateIndexEntry[] = JSON.parse(indexData);
      const filtered = index.filter((t) => t.templateId !== templateId);
      localStorage.setItem(INDEX_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.error('Failed to delete template from localStorage:', error);
  }
}

/**
 * Check if localStorage has available space
 */
export function checkLocalStorageSpace(): {
  available: boolean;
  error?: string;
} {
  try {
    // Test write with 1MB test data
    const testKey = '__storage_test__';
    const testData = 'x'.repeat(1024 * 1024); // 1MB
    localStorage.setItem(testKey, testData);
    localStorage.removeItem(testKey);
    return { available: true };
  } catch (error) {
    return {
      available: false,
      error: 'LocalStorage 공간이 부족합니다.',
    };
  }
}

/**
 * Update sync status for a template
 */
export function updateTemplateSyncStatus(
  templateId: number,
  syncedWithServer: boolean
): void {
  try {
    // Update stored template
    const key = `${STORAGE_PREFIX}${templateId}`;
    const data = localStorage.getItem(key);
    if (data) {
      const stored: StoredTemplate = JSON.parse(data);
      stored.metadata.syncedWithServer = syncedWithServer;
      stored.metadata.serverSyncedAt = syncedWithServer
        ? Date.now()
        : undefined;
      localStorage.setItem(key, JSON.stringify(stored));
    }

    // Update index
    const indexData = localStorage.getItem(INDEX_KEY);
    if (indexData) {
      const index: TemplateIndexEntry[] = JSON.parse(indexData);
      const entry = index.find((t) => t.templateId === templateId);
      if (entry) {
        entry.syncedWithServer = syncedWithServer;
        localStorage.setItem(INDEX_KEY, JSON.stringify(index));
      }
    }
  } catch (error) {
    console.error('Failed to update sync status:', error);
  }
}
