/** Editor header for local-first template editing. */

import { Input } from '@/components/ui/input';
import { BackButton } from './BackButton';
import { SaveButton } from './SaveButton';
import { useEditorContext } from '@/hooks/useEditorContext';
import {
  checkTemplateStorageAvailability,
  saveTemplateToLocalStorage,
} from '@/utils/templateStorage';
import { toast } from 'sonner';
import { errorLog } from '@/utils/logger';
import {
  sendTemplateSaveFail,
  sendTemplateSaveSuccess,
} from '@/utils/analytics';

export const EditorHeader = () => {
  const { state, dispatch } = useEditorContext();

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'UPDATE_TEMPLATE_NAME', payload: event.target.value });
  };

  const handleSave = async () => {
    if (!state.template) return;

    dispatch({ type: 'START_SAVING' });
    try {
      const storageCheck = checkTemplateStorageAvailability();
      if (!storageCheck.available) throw new Error(storageCheck.error);

      // The storage layer allocates the id for a new template. Minting one
      // from the clock here could collide with an existing template and
      // overwrite it without a trace.
      const stored = await saveTemplateToLocalStorage(
        {
          ...state.template,
          syncStatus: 'local' as const,
          updatedAt: new Date().toISOString(),
        },
        state.stagingItems,
      );
      const savedTemplate = stored.template;
      dispatch({ type: 'SAVE_SUCCESS', payload: savedTemplate });

      const origin = savedTemplate.cloned ? 'cloned' : 'owned';
      sendTemplateSaveSuccess(
        savedTemplate.templateId,
        origin,
        savedTemplate.items.length,
      );
      toast.success('저장 완료', {
        description: '이 기기의 IndexedDB에 저장했습니다.',
      });
    } catch (error) {
      errorLog('[EditorHeader] Save failed:', error);
      const message =
        error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.';
      dispatch({ type: 'SAVE_FAILED', payload: message });
      sendTemplateSaveFail(state.template.templateId, 'save_error', message);
      toast.error('저장 실패', { description: message });
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
          <span className="text-sm text-green-600">• 이 기기에 저장됨</span>
        )}
      </div>

      <SaveButton onSave={handleSave} isSaving={state.isSaving} />
    </header>
  );
};
