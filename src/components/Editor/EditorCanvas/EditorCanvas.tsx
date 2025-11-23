/**
 * Editor Canvas - Main canvas for template editor with drag-and-drop
 * Supports dragging from staging area and moving items on canvas
 * DndContext is now at EditorPage level
 */

import { useDroppable } from '@dnd-kit/core';
import { useEditorContext } from '@/contexts/EditorContext';
import { DraggableItem } from './DraggableItem';
import { CanvasGrid } from './CanvasGrid';

export const EditorCanvas = () => {
  const { state, dispatch } = useEditorContext();
  const { setNodeRef: setCanvasRef, isOver } = useDroppable({
    id: 'canvas-area',
  });

  const handleCanvasClick = () => {
    // Deselect item when clicking on empty canvas
    dispatch({ type: 'SELECT_ITEM', payload: null });
  };

  if (!state.template) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-2">
          <p className="text-sm text-destructive">{state.error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 relative overflow-auto bg-gray-50 p-8"
      onClick={handleCanvasClick}
    >
      <div
        ref={setCanvasRef}
        className={`relative bg-white shadow-lg mx-auto transition-colors ${
          isOver ? 'ring-2 ring-primary' : ''
        }`}
        style={{
          width: '500px',
          height: '396px',
          minHeight: '396px',
        }}
      >
        <CanvasGrid height={state.template.height} />

        {/* Render all template items */}
        {state.template.items.map((item) => (
          <DraggableItem
            key={item.templateItemId}
            item={item}
            isSelected={state.selectedItemId === item.templateItemId}
          />
        ))}

        {/* Empty state */}
        {state.template.items.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">
                템플릿이 비어있습니다
              </p>
              <p className="text-sm text-muted-foreground">
                왼쪽 사이드바에서 아이템을 추가하세요
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
