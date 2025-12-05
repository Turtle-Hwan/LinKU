/**
 * usePostedTemplates hook
 * Manages posted templates state and server synchronization
 */

import { useCallback } from 'react';
import { usePostedTemplatesContext } from '@/contexts/PostedTemplatesContext';
import {
  getMyPostedTemplates,
  getPostedTemplateDetail,
  deletePostedTemplate,
  likePostedTemplate as likePostedTemplateApi,
} from '@/apis/posted-templates';
import { postTemplate } from '@/apis/templates';
import { areItemsEqual } from '@/utils/templateUtils';
import type { TemplateItem, PostedTemplateSummary } from '@/types/api';

interface PublishResult {
  success: boolean;
  error?: string;
  data?: PostedTemplateSummary;
}

export function usePostedTemplates() {
  const { state, dispatch } = usePostedTemplatesContext();

  /**
   * Load posted templates from server
   */
  const loadPostedTemplates = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await getMyPostedTemplates();
      if (result.success && result.data) {
        dispatch({ type: 'SET_TEMPLATES', payload: result.data });
      } else {
        dispatch({ type: 'SET_ERROR', payload: result.error?.message || '로드 실패' });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '네트워크 오류' });
      console.error('Failed to load posted templates:', error);
    }
  }, [dispatch]);

  /**
   * Publish template to gallery (with duplicate check)
   */
  const publishTemplate = useCallback(
    async (
      templateId: number,
      currentItems: TemplateItem[]
    ): Promise<PublishResult> => {
      // Duplicate check against existing posted templates
      if (currentItems.length > 0) {
        for (const posted of state.postedTemplates) {
          try {
            const detailResult = await getPostedTemplateDetail(posted.postedTemplateId);
            if (detailResult.success && detailResult.data?.items) {
              if (areItemsEqual(currentItems, detailResult.data.items)) {
                return {
                  success: false,
                  error: '이미 게시된 템플릿과 동일한 내용입니다.',
                };
              }
            }
          } catch {
            // Skip if detail load fails
          }
        }
      }

      // Publish request
      try {
        const result = await postTemplate(templateId);
        if (result.success && result.data) {
          // Reload posted templates to get the new one
          await loadPostedTemplates();
          return { success: true };
        }
        return {
          success: false,
          error: result.error?.message || '게시에 실패했습니다.',
        };
      } catch {
        return { success: false, error: '네트워크 오류' };
      }
    },
    [state.postedTemplates, loadPostedTemplates]
  );

  /**
   * Unpost (delete) a posted template
   */
  const unpostTemplate = useCallback(
    async (postedTemplateId: number): Promise<boolean> => {
      try {
        const result = await deletePostedTemplate(postedTemplateId);
        if (result.success) {
          dispatch({ type: 'REMOVE_TEMPLATE', payload: postedTemplateId });
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [dispatch]
  );

  /**
   * Toggle like on a posted template
   */
  const likeTemplate = useCallback(
    async (postedTemplateId: number): Promise<boolean> => {
      try {
        const result = await likePostedTemplateApi(postedTemplateId);
        if (result.success && result.data) {
          dispatch({
            type: 'UPDATE_TEMPLATE',
            payload: {
              postedTemplateId,
              isLiked: result.data.isLiked,
              likesCount: result.data.likeCount,
            },
          });
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [dispatch]
  );

  return {
    // State
    postedTemplates: state.postedTemplates,
    isLoading: state.isLoading,
    error: state.error,
    count: state.postedTemplates.length,

    // Actions
    loadPostedTemplates,
    publishTemplate,
    unpostTemplate,
    likeTemplate,
  };
}
