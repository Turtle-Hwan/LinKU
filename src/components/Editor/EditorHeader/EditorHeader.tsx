/**
 * Editor Header - Top bar with template name, save, and publish controls
 */

import { useEditorContext } from '@/hooks/useEditorContext';
import { Input } from '@/components/ui/input';
import { SaveButton } from './SaveButton';
import { SyncButton } from './SyncButton';
import { PublishButton } from './PublishButton';
import { BackButton } from './BackButton';
import { useTemplateSync } from '@/hooks/useTemplateSync';
import { useTemplatePublish } from '@/hooks/useTemplatePublish';
import { usePostedTemplates } from '@/hooks/usePostedTemplates';
import { toast } from 'sonner';
import {
  saveTemplateToLocalStorage,
  checkLocalStorageSpace,
} from '@/utils/templateStorage';
import { getTemplate } from '@/apis/templates';
import { areTemplatesEqual } from '@/utils/templateUtils';
import { debugLog, errorLog } from '@/utils/logger';
import {
  sendTemplateSaveSuccess,
  sendTemplateSaveFail,
  sendTemplateSyncSuccess,
  sendTemplateSyncFail,
  sendTemplatePublishSuccess,
  sendTemplatePublishFail,
} from '@/utils/analytics';

export const EditorHeader = () => {
  const { state, dispatch } = useEditorContext();
  const { syncToServer } = useTemplateSync();
  const { publishTemplate } = useTemplatePublish();
  const { loadPostedTemplates } = usePostedTemplates();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'UPDATE_TEMPLATE_NAME', payload: e.target.value });
  };

  const handleSave = async () => {
    if (!state.template) return;

    // 복제된 템플릿인 경우: 서버 원본과 비교하여 변경 여부 확인
    if (state.template.cloned) {
      try {
        const serverResult = await getTemplate(state.template.templateId);
        if (serverResult.success && serverResult.data) {
          if (areTemplatesEqual(serverResult.data, state.template)) {
            toast.info('수정된 내용이 없습니다.');
            return;
          }
        }
      } catch (error) {
        errorLog('[EditorHeader] Failed to fetch original template:', error);
        // 원본 확인 실패 시 저장 진행 (fail-safe)
      }
    }

    debugLog('[EditorHeader] handleSave started:', {
      currentTemplateId: state.template.templateId,
      mode: state.mode,
      templateName: state.template.name,
    });

    dispatch({ type: 'START_SAVING' });

    try {
      // Check localStorage space
      const spaceCheck = checkLocalStorageSpace();
      if (!spaceCheck.available) {
        throw new Error(spaceCheck.error);
      }

      // Generate new templateId if creating new template
      // Check templateId directly (0 = draft/new template) instead of relying on mode
      let savedTemplate = state.template;
      if (state.template.templateId === 0) {
        // Draft template - generate new ID
        const newId = Date.now();
        savedTemplate = {
          ...state.template,
          templateId: newId,
          updatedAt: new Date().toISOString(),
        };
        debugLog('[EditorHeader] Generated new ID for draft template:', newId);
      } else {
        // Existing template - keep ID
        savedTemplate = {
          ...state.template,
          updatedAt: new Date().toISOString(),
        };
        debugLog('[EditorHeader] Using existing ID for saved template:', savedTemplate.templateId);
      }

      debugLog('[EditorHeader] Saving template:', {
        templateId: savedTemplate.templateId,
        name: savedTemplate.name,
        itemCount: savedTemplate.items.length,
      });

      // Save to localStorage
      await saveTemplateToLocalStorage(
        savedTemplate,
        state.stagingItems,
        false // Not synced with server
      );

      dispatch({ type: 'SAVE_SUCCESS', payload: savedTemplate });

      const origin = savedTemplate.cloned ? 'cloned' : 'owned';
      sendTemplateSaveSuccess(savedTemplate.templateId, origin, savedTemplate.items.length);

      toast.success('저장 완료', {
        description: '템플릿이 로컬에 저장되었습니다.',
      });
    } catch (error) {
      errorLog('[EditorHeader] Save failed:', error);
      const errMsg = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.';
      dispatch({ type: 'SAVE_FAILED', payload: errMsg });
      sendTemplateSaveFail(state.template.templateId, 'save_error', errMsg);
      toast.error('저장 실패', { description: errMsg });
    }
  };

  const handleSyncToServer = async () => {
    if (!state.template) return;

    // 복제된 템플릿인 경우: 서버 원본과 비교하여 변경 여부 확인
    if (state.template.cloned) {
      try {
        const serverResult = await getTemplate(state.template.templateId);
        if (serverResult.success && serverResult.data) {
          if (areTemplatesEqual(serverResult.data, state.template)) {
            toast.info('수정된 내용이 없습니다.');
            return;
          }
        }
      } catch (error) {
        errorLog('[EditorHeader] Failed to fetch original template:', error);
        // 원본 확인 실패 시 동기화 진행 (fail-safe)
      }
    }

    dispatch({ type: 'START_SYNCING' });
    const result = await syncToServer(state.template, state.stagingItems);

    if (result.success && result.data) {
      dispatch({ type: 'SYNC_SUCCESS', payload: result.data });
      sendTemplateSyncSuccess(
        state.template.templateId,
        result.data.items?.length ?? state.template.items.length
      );
      toast.success('동기화 완료', {
        description: '템플릿이 서버에 동기화되었습니다.',
      });
    } else {
      const errorMsg = result.error || '동기화에 실패했습니다.';
      dispatch({ type: 'SYNC_FAILED', payload: errorMsg });
      sendTemplateSyncFail(state.template.templateId, 'sync_failed', errorMsg);
      toast.error('동기화 실패', { description: errorMsg });
    }
  };

  const handlePublish = async () => {
    if (!state.template || state.mode === 'create') {
      toast.error('알림', {
        description: '먼저 템플릿을 저장해주세요.',
      });
      return;
    }

    const currentItems = state.template.items || [];
    const result = await publishTemplate(state.template.templateId, currentItems);

    if (result.success) {
      await loadPostedTemplates();
      sendTemplatePublishSuccess(state.template.templateId, currentItems.length);
      toast.success('게시 완료', {
        description: '템플릿이 공개 갤러리에 게시되었습니다.',
      });
    } else {
      const errMsg = result.error || '게시에 실패했습니다.';
      sendTemplatePublishFail(state.template.templateId, 'publish_failed', errMsg);
      toast.error('게시 실패', { description: errMsg });
    }
  };

  return (
    <header className="h-16 border-b bg-background px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4 flex-1">
        <BackButton />
        <Input
          value={state.template?.name || ''}
          onChange={handleNameChange}
          className="w-64"
          placeholder="템플릿 이름"
        />
        {state.isSaving ? (
          <span className="text-sm text-muted-foreground">• 저장 중...</span>
        ) : state.isDirty ? (
          <span className="text-sm text-yellow-600">• 저장되지 않음</span>
        ) : (
          <span className="text-sm text-green-600">• 저장 완료됨</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <SaveButton onSave={handleSave} isSaving={state.isSaving} />
        <SyncButton
          onSync={handleSyncToServer}
          isSyncing={state.isSyncing}
        />
        <PublishButton
          onPublish={handlePublish}
          disabled={state.mode === 'create' || state.isDirty}
        />
      </div>
    </header>
  );
};
