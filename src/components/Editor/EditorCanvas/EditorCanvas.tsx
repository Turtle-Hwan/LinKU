/**
 * Editor Canvas - Main canvas for template editor with drag-and-drop
 * Converts pixel drag deltas to grid coordinates
 */

import { DndContext, DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useEditorContext } from '@/contexts/EditorContext';
import { DraggableItem } from './DraggableItem';
import { CanvasGrid } from './CanvasGrid';
import { gridToPixelPosition, pixelToGridPosition } from '@/utils/template';

export const EditorCanvas = () => {
  const { state, dispatch } = useEditorContext();

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const itemId = event.active.id as number;
    dispatch({ type: 'SELECT_ITEM', payload: itemId });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    const itemId = active.id as number;

    const item = state.template?.items.find((i) => i.templateItemId === itemId);
    if (!item) return;

    // Convert grid position to pixel, add delta, then convert back to grid
    const currentPixelPos = gridToPixelPosition(item.position);
    const newPixelPos = {
      x: currentPixelPos.x + delta.x,
      y: currentPixelPos.y + delta.y,
    };

    // Convert pixel position back to grid coordinates (with snapping)
    const newGridPos = pixelToGridPosition(newPixelPos);

    dispatch({
      type: 'MOVE_ITEM',
      payload: {
        id: itemId,
        position: newGridPos, // Grid coordinates (0-5, 0-5)
      },
    });
  };

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
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          className="relative bg-white shadow-lg mx-auto"
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
            <div className="absolute inset-0 flex items-center justify-center">
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
      </DndContext>
    </div>
  );
};
