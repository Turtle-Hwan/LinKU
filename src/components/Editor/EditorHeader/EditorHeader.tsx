/**
 * Editor Header - Top bar with template name, save, and publish controls
 */

import { useEditorContext } from '@/contexts/EditorContext';
import { Input } from '@/components/ui/input';
import { SaveButton } from './SaveButton';
import { SyncButton } from './SyncButton';
import { PublishButton } from './PublishButton';
import { BackButton } from './BackButton';
import { postTemplate, syncTemplateToServer } from '@/apis/templates';
import { toast } from 'sonner';
import {
  saveTemplateToLocalStorage,
  checkLocalStorageSpace,
  updateTemplateSyncStatus,
} from '@/utils/templateStorage';

export const EditorHeader = () => {
  const { state, dispatch } = useEditorContext();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'UPDATE_TEMPLATE_NAME', payload: e.target.value });
  };

  const handleSave = async () => {
    if (!state.template) return;

    dispatch({ type: 'START_SAVING' });

    try {
      // Check localStorage space
      const spaceCheck = checkLocalStorageSpace();
      if (!spaceCheck.available) {
        throw new Error(spaceCheck.error);
      }

      // Generate new templateId if creating new template
      let savedTemplate = state.template;
      if (state.mode === 'create') {
        // For local-only templates, use timestamp as ID
        savedTemplate = {
          ...state.template,
          templateId: Date.now(),
          updatedAt: new Date().toISOString(),
        };
      } else {
        savedTemplate = {
          ...state.template,
          updatedAt: new Date().toISOString(),
        };
      }

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
        // Update template with server ID
        dispatch({ type: 'SYNC_SUCCESS', payload: result.data });

        // Update localStorage sync status
        updateTemplateSyncStatus(result.data.templateId, true);

        toast.success('동기화 완료', {
          description: '템플릿이 서버에 동기화되었습니다.',
        });
      } else {
        dispatch({
          type: 'SYNC_FAILED',
          payload: result.error?.message || '동기화 실패',
        });
        toast.error('동기화 실패', {
          description: result.error?.message,
        });
      }
    } catch (error) {
      dispatch({
        type: 'SYNC_FAILED',
        payload: '동기화 중 오류가 발생했습니다.',
      });
      toast.error('오류', {
        description: '동기화 중 오류가 발생했습니다.',
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
      const result = await postTemplate(state.template.templateId);
      if (result.success) {
        toast.success('게시 완료', {
          description: '템플릿이 공개 갤러리에 게시되었습니다.',
        });
      } else {
        toast.error('게시 실패', {
          description: result.error?.message,
        });
      }
    } catch (error) {
      toast.error('오류', {
        description: '게시 중 오류가 발생했습니다.',
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
          syncStatus={state.syncStatus}
        />
        <PublishButton
          onPublish={handlePublish}
          disabled={state.mode === 'create' || state.isDirty}
        />
      </div>
    </header>
  );
};
