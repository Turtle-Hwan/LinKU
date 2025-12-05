/**
 * Editor Header - Top bar with template name, save, and publish controls
 */

import { useEditorContext } from '@/contexts/EditorContext';
import { Input } from '@/components/ui/input';
import { SaveButton } from './SaveButton';
import { SyncButton } from './SyncButton';
import { PublishButton } from './PublishButton';
import { BackButton } from './BackButton';
import { syncTemplateToServer } from '@/apis/templates';
import { usePostedTemplates } from '@/hooks/usePostedTemplates';
import { toast } from 'sonner';
import {
  saveTemplateToLocalStorage,
  deleteTemplateFromLocalStorage,
  checkLocalStorageSpace,
} from '@/utils/templateStorage';
import { getErrorMessage } from '@/utils/apiErrorHandler';

export const EditorHeader = () => {
  const { state, dispatch } = useEditorContext();
  const { publishTemplate } = usePostedTemplates();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'UPDATE_TEMPLATE_NAME', payload: e.target.value });
  };

  const handleSave = async () => {
    if (!state.template) return;

    console.log('[EditorHeader] handleSave started:', {
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
        console.log('[EditorHeader] Generated new ID for draft template:', newId);
      } else {
        // Existing template - keep ID
        savedTemplate = {
          ...state.template,
          updatedAt: new Date().toISOString(),
        };
        console.log('[EditorHeader] Using existing ID for saved template:', savedTemplate.templateId);
      }

      console.log('[EditorHeader] Saving template:', {
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

      toast.success('저장 완료', {
        description: '템플릿이 로컬에 저장되었습니다.',
      });
    } catch (error) {
      console.error('[EditorHeader] Save failed:', error);
      dispatch({
        type: 'SAVE_FAILED',
        payload:
          error instanceof Error
            ? error.message
            : '저장 중 오류가 발생했습니다.',
      });
      toast.error('저장 실패', {
        description:
          error instanceof Error
            ? error.message
            : '저장 중 오류가 발생했습니다.',
      });
    }
  };

  const handleSyncToServer = async () => {
    if (!state.template) return;

    dispatch({ type: 'START_SYNCING' });

    try {
      const result = await syncTemplateToServer(state.template);

      if (result.success && result.data) {
        const oldTemplateId = state.template.templateId;
        const newTemplateId = result.data.templateId;

        // Update template with server ID
        dispatch({ type: 'SYNC_SUCCESS', payload: result.data });

        // 이전 ID와 새 ID가 다르면 이전 localStorage 삭제
        if (oldTemplateId !== newTemplateId) {
          deleteTemplateFromLocalStorage(oldTemplateId);
        }

        // 새 ID로 저장 (동기화 상태 포함)
        await saveTemplateToLocalStorage(
          { ...result.data, syncStatus: 'synced' },
          state.stagingItems,
          true // synced with server
        );

        toast.success('동기화 완료', {
          description: '템플릿이 서버에 동기화되었습니다.',
        });
      } else {
        const errorMsg = getErrorMessage(result, '동기화 실패');
        dispatch({
          type: 'SYNC_FAILED',
          payload: errorMsg,
        });
        toast.error('동기화 실패', {
          description: errorMsg,
        });
      }
    } catch (error) {
      const errorMsg = '서버와 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
      dispatch({
        type: 'SYNC_FAILED',
        payload: errorMsg,
      });
      toast.error('네트워크 오류', {
        description: errorMsg,
      });
    }
  };

  const handlePublish = async () => {
    if (!state.template || state.mode === 'create') {
      toast.error('알림', {
        description: '먼저 템플릿을 저장해주세요.',
      });
      return;
    }

    try {
      // publishTemplate 훅 사용 (중복 체크 포함)
      const currentItems = state.template.items || [];
      const result = await publishTemplate(state.template.templateId, currentItems);

      if (result.success) {
        toast.success('게시 완료', {
          description: '템플릿이 공개 갤러리에 게시되었습니다.',
        });
      } else {
        toast.error('게시 불가', {
          description: result.error || '게시에 실패했습니다.',
        });
      }
    } catch (error) {
      toast.error('네트워크 오류', {
        description: '서버와 연결할 수 없습니다. 네트워크 연결을 확인해주세요.',
      });
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
