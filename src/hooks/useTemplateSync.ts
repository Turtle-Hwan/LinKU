/**
 * useTemplateSync hook
 * Syncs templates to server (Option A - callback style)
 * Returns result only, caller handles toast/state updates
 */

import { useState } from 'react';
import { syncTemplateToServer } from '@/apis/templates';
import {
  saveTemplateToLocalStorage,
  deleteTemplateFromLocalStorage,
} from '@/utils/templateStorage';
import { getErrorMessage } from '@/utils/apiErrorHandler';
import type { Template, TemplateItem } from '@/types/api';

interface SyncResult {
  success: boolean;
  data?: Template;
  error?: string;
}

export function useTemplateSync() {
  const [isSyncing, setIsSyncing] = useState(false);

  const syncToServer = async (
    template: Template,
    stagingItems: TemplateItem[] = []
  ): Promise<SyncResult> => {
    setIsSyncing(true);

    try {
      const result = await syncTemplateToServer(template);

      if (result.success && result.data) {
        const oldTemplateId = template.templateId;
        const newTemplateId = result.data.templateId;

        // 이전 ID와 새 ID가 다르면 이전 localStorage 삭제
        if (oldTemplateId !== newTemplateId) {
          deleteTemplateFromLocalStorage(oldTemplateId);
        }

        // 새 ID로 저장 (동기화 상태 포함)
        await saveTemplateToLocalStorage(
          { ...result.data, syncStatus: 'synced' },
          stagingItems,
          true // synced with server
        );

        return { success: true, data: result.data };
      } else {
        const errorMsg = getErrorMessage(result, '동기화 실패');
        return { success: false, error: errorMsg };
      }
    } catch {
      return { success: false, error: '서버와 연결할 수 없습니다.' };
    } finally {
      setIsSyncing(false);
    }
  };

  return { syncToServer, isSyncing };
}
