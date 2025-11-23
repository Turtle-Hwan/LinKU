/**
 * Staging Area - Temporary storage for template items
 * Items can be dragged to canvas or deleted permanently
 */

import { useEditorContext } from '@/contexts/EditorContext';
import { StagingItem } from './StagingItem';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

export const StagingArea = () => {
  const { state, dispatch } = useEditorContext();
  const { setNodeRef, isOver } = useDroppable({
    id: 'staging-area',
  });

  const handleDeleteItem = (itemId: number) => {
    dispatch({ type: 'REMOVE_FROM_STAGING', payload: itemId });
  };

  return (
    <div className="flex-1 p-4 min-h-[200px] overflow-hidden">
      <h3 className="font-semibold text-sm mb-3">임시 저장 공간</h3>

      <div
        ref={setNodeRef}
        className={cn(
          'min-h-[150px] max-h-[400px] border-2 border-dashed rounded-lg p-3 transition-colors overflow-y-auto',
          isOver ? 'border-primary bg-primary/5' : 'border-gray-300 bg-gray-50/50'
        )}
      >
        {state.stagingItems && state.stagingItems.length > 0 ? (
          <div className="space-y-2">
            {state.stagingItems.map((item) => (
              <StagingItem
                key={item.templateItemId}
                item={item}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-1">
              <p className="text-xs text-muted-foreground">
                임시 저장된 아이템이 없습니다
              </p>
              <p className="text-[10px] text-muted-foreground">
                캔버스에서 아이템을 제거하면 여기로 이동합니다
              </p>
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground mt-2">
        💡 아이템을 드래그하여 캔버스에 추가하거나, 삭제 버튼을 눌러 영구 제거할 수 있습니다
      </p>
    </div>
  );
};
