/**
 * Editor Header - Top bar with template name, save, and publish controls
 */

import { useEditorContext } from '@/contexts/EditorContext';
import { Input } from '@/components/ui/input';
import { SaveButton } from './SaveButton';
import { PublishButton } from './PublishButton';
import { BackButton } from './BackButton';
import { createTemplate, updateTemplate, postTemplate } from '@/apis/templates';
import { toast } from 'sonner';

export const EditorHeader = () => {
  const { state, dispatch } = useEditorContext();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'UPDATE_TEMPLATE_NAME', payload: e.target.value });
  };

  const handleSave = async () => {
    if (!state.template) return;

    dispatch({ type: 'START_SAVING' });

    try {
      const payload = {
        templateId: state.template.templateId,
        name: state.template.name,
        height: state.template.height,
        items: state.template.items.map((item) => ({
          name: item.name,
          siteUrl: item.siteUrl,
          iconId: item.icon.iconId,
          position: item.position,
          size: item.size,
        })),
      };

      const result =
        state.mode === 'create'
          ? await createTemplate(payload)
          : await updateTemplate(state.template.templateId, payload);

      if (result.success && result.data) {
        dispatch({ type: 'SAVE_SUCCESS', payload: result.data });

        // Cache template in Chrome Extension Storage for offline access
        try {
          await chrome.storage.local.set({
            [`template_${result.data.templateId}`]: result.data,
            [`template_${result.data.templateId}_updated`]: Date.now(),
          });
        } catch (storageError) {
          console.warn('Failed to cache template:', storageError);
          // Non-critical error - don't show to user
        }

        toast.success('저장 완료', {
          description: '템플릿이 저장되었습니다.',
        });
      } else {
        dispatch({
          type: 'SAVE_FAILED',
          payload: result.error?.message || '저장 실패',
        });
        toast.error('저장 실패', {
          description: result.error?.message,
        });
      }
    } catch (error) {
      dispatch({
        type: 'SAVE_FAILED',
        payload: '저장 중 오류가 발생했습니다.',
      });
      toast.error('오류', {
        description: '저장 중 오류가 발생했습니다.',
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
        {state.isDirty && (
          <span className="text-sm text-muted-foreground">• 저장되지 않음</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <SaveButton onSave={handleSave} isSaving={state.isSaving} />
        <PublishButton
          onPublish={handlePublish}
          disabled={state.mode === 'create' || state.isDirty}
        />
      </div>
    </header>
  );
};
