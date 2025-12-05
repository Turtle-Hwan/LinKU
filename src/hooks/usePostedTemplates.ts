/**
 * usePostedTemplates hook
 * Manages posted templates state (global context)
 * Note: publishTemplate moved to useTemplatePublish hook (Option A style)
 */

import { useCallback } from 'react';
import { usePostedTemplatesContext } from '@/contexts/PostedTemplatesContext';
import {
  getMyPostedTemplates,
  getPostedTemplateDetail,
  deletePostedTemplate,
  likePostedTemplate as likePostedTemplateApi,
} from '@/apis/posted-templates';
import type { LikeTemplateResponse } from '@/types/api';

// Result types for error message propagation
interface LikeResult {
  success: boolean;
  error?: string;
  data?: LikeTemplateResponse;
}

interface UnpostResult {
  success: boolean;
  error?: string;
}

export function usePostedTemplates() {
  const { state, dispatch } = usePostedTemplatesContext();

  /**
   * Load posted templates from server (with detail items for preview)
   */
  const loadPostedTemplates = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await getMyPostedTemplates();
      if (result.success && result.data) {
        // 각 템플릿의 상세 items 로드 (미리보기용)
        const templatesWithItems = await Promise.all(
          result.data.map(async (template) => {
            const detailResult = await getPostedTemplateDetail(template.postedTemplateId);
            return {
              ...template,
              detailItems: detailResult.success ? detailResult.data?.items : undefined,
            };
          })
        );
        dispatch({ type: 'SET_TEMPLATES', payload: templatesWithItems });
      } else {
        dispatch({ type: 'SET_ERROR', payload: result.error?.message || '로드 실패' });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: '네트워크 오류' });
      console.error('Failed to load posted templates:', error);
    }
  }, [dispatch]);

  /**
   * Unpost (delete) a posted template
   * Returns Result object with error message for proper toast display
   */
  const unpostTemplate = useCallback(
    async (postedTemplateId: number): Promise<UnpostResult> => {
      try {
        const result = await deletePostedTemplate(postedTemplateId);
        if (result.success) {
          dispatch({ type: 'REMOVE_TEMPLATE', payload: postedTemplateId });
          return { success: true };
        }
        return {
          success: false,
          error: result.error?.message || '게시 취소에 실패했습니다.',
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '네트워크 오류',
        };
      }
    },
    [dispatch]
  );

  /**
   * Toggle like on a posted template
   * Returns Result object with error message for proper toast display
   */
  const likeTemplate = useCallback(
    async (postedTemplateId: number): Promise<LikeResult> => {
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
          return { success: true, data: result.data };
        }
        return {
          success: false,
          error: result.error?.message || '좋아요 처리에 실패했습니다.',
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '네트워크 오류',
        };
      }
    },
    [dispatch]
  );

  return {
    // State
    postedTemplates: state.postedTemplates,
    isLoading: state.isLoading,
    error: state.error,

    // Actions
    loadPostedTemplates,
    unpostTemplate,
    likeTemplate,
  };
}
