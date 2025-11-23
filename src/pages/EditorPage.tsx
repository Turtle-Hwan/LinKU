/**
 * Editor Page - Template editor main page
 * Wraps editor components in EditorProvider for state management
 * Contains DndContext at top level to enable drag-drop between sidebar and canvas
 */

import { useParams } from 'react-router-dom';
import { DndContext, DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { EditorProvider, useEditorContext } from '@/contexts/EditorContext';
import { EditorHeader } from '@/components/Editor/EditorHeader/EditorHeader';
import { EditorCanvas } from '@/components/Editor/EditorCanvas/EditorCanvas';
import { EditorSidebar } from '@/components/Editor/EditorSidebar/EditorSidebar';
import { ItemPropertiesPanel } from '@/components/Editor/ItemPropertiesPanel';
import { gridToPixelPosition, pixelToGridPosition, clampToGridBounds, resolveCollisions } from '@/utils/template';
import { toast } from 'sonner';

const EditorContent = () => {
  const { state, dispatch } = useEditorContext();

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // 3px of movement required before drag starts
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const draggedId = event.active.id;

    // Check if it's a staging item (string id starting with 'staging-')
    if (typeof draggedId === 'string' && draggedId.startsWith('staging-')) {
      // Don't select staging items during drag
      return;
    }

    // Select canvas item
    dispatch({ type: 'SELECT_ITEM', payload: draggedId as number });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta, over } = event;
    const draggedId = active.id;

    // Check if it's a staging item
    if (typeof draggedId === 'string' && draggedId.startsWith('staging-')) {
      // Staging item dropped on canvas
      if (over && over.id === 'canvas-area') {
        const itemId = parseInt(draggedId.replace('staging-', ''));
        dispatch({ type: 'MOVE_TO_CANVAS', payload: itemId });
      }
      return;
    }

    // Canvas item being moved
    const itemId = draggedId as number;
    const item = state.template?.items.find((i) => i.templateItemId === itemId);
    if (!item || !state.template) return;

    // Convert grid position to pixel, add delta, then convert back to grid
    const currentPixelPos = gridToPixelPosition(item.position);
    const newPixelPos = {
      x: currentPixelPos.x + delta.x,
      y: currentPixelPos.y + delta.y,
    };

    // Convert pixel position back to grid coordinates (with snapping)
    const newGridPos = pixelToGridPosition(newPixelPos);

    // Clamp position to grid bounds considering item size
    const clampedPos = clampToGridBounds(newGridPos, item.size);

    // Try to resolve collisions
    const positionChanges = resolveCollisions(
      itemId,
      clampedPos,
      state.template.items
    );

    if (positionChanges) {
      // Apply all position changes (moving item + pushed items)
      positionChanges.forEach((newPos, affectedItemId) => {
        dispatch({
          type: 'MOVE_ITEM',
          payload: {
            id: affectedItemId,
            position: newPos,
          },
        });
      });

      // Show notification if items were pushed
      if (positionChanges.size > 1) {
        toast.info(`${positionChanges.size - 1}개의 아이템이 밀려났습니다`);
      }
    } else {
      // Collision resolution failed, revert to original position
      toast.error('아이템을 배치할 수 없습니다. 공간이 부족합니다.');
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full flex flex-col">
        <EditorHeader />
        <div className="flex-1 flex overflow-hidden">
          <EditorSidebar />
          <EditorCanvas />
          <ItemPropertiesPanel />
        </div>
      </div>
    </DndContext>
  );
};

export const EditorPage = () => {
  const { templateId } = useParams<{ templateId: string }>();

  return (
    <EditorProvider templateId={templateId ? parseInt(templateId) : undefined}>
      <EditorContent />
    </EditorProvider>
  );
};
