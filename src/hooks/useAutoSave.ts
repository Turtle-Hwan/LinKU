/**
 * useAutoSave hook - Debounced auto-save for template editor
 * Automatically saves template changes after a delay
 */

import { useEffect, useRef } from 'react';
import { useEditorContext } from '@/contexts/EditorContext';
import { updateTemplate } from '@/apis/templates';

interface UseAutoSaveOptions {
  enabled?: boolean;
  delay?: number;
}

/**
 * Auto-save hook with debouncing
 */
export const useAutoSave = (options: UseAutoSaveOptions = {}) => {
  const { enabled = true, delay = 3000 } = options;
  const { state } = useEditorContext();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only auto-save if:
    // 1. Auto-save is enabled
    // 2. There are unsaved changes
    // 3. We're in edit mode (not create mode)
    // 4. Not currently saving
    if (!enabled || !state.isDirty || state.mode === 'create' || state.isSaving) {
      return;
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(async () => {
      if (state.template) {
        try {
          console.log('[AutoSave] Saving template...', state.template.templateId);

          await updateTemplate(state.template.templateId, {
            name: state.template.name,
            height: state.template.height,
            items: state.template.items.map((item) => ({
              name: item.name,
              siteUrl: item.siteUrl,
              id: item.icon.id,
              position: item.position,
              size: item.size,
            })),
          });

          console.log('[AutoSave] Template saved successfully');
        } catch (error) {
          console.error('[AutoSave] Failed to save template:', error);
        }
      }
    }, delay);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, state.isDirty, state.template, state.mode, state.isSaving, delay]);
};
