/**
 * useTemplatePublish hook
 * Publishes templates to gallery (Option A - callback style)
 * Returns result only, caller handles toast/state updates
 */

import { useState } from 'react';
import { postTemplate } from '@/apis/templates';
import {
  getMyPostedTemplates,
  getPostedTemplateDetail,
} from '@/apis/posted-templates';
import { areItemsEqual } from '@/utils/templateUtils';
import type { TemplateItem, PostTemplateResponse } from '@/types/api';

interface PublishResult {
  success: boolean;
  error?: string;
  data?: PostTemplateResponse;
}

export function useTemplatePublish() {
  const [isPublishing, setIsPublishing] = useState(false);

  const publishTemplate = async (
    templateId: number,
    currentItems: TemplateItem[]
  ): Promise<PublishResult> => {
    setIsPublishing(true);

    try {
      // 중복 게시 체크
      if (currentItems.length > 0) {
        const postedResult = await getMyPostedTemplates();
        if (postedResult.success && postedResult.data) {
          for (const posted of postedResult.data) {
            try {
              const detailResult = await getPostedTemplateDetail(
                posted.postedTemplateId
              );
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
      }

      // 게시 요청
      const result = await postTemplate(templateId);
      if (result.success && result.data) {
        return { success: true, data: result.data };
      }
      return {
        success: false,
        error: result.error?.message || '게시에 실패했습니다.',
      };
    } catch {
      return { success: false, error: '네트워크 오류' };
    } finally {
      setIsPublishing(false);
    }
  };

  return { publishTemplate, isPublishing };
}
