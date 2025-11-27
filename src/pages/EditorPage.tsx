/**
 * Editor Page - Template editor main page
 * Wraps editor components in EditorProvider for state management
 * Contains DndContext at top level to enable drag-drop between sidebar and canvas
 */

import { useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { EditorProvider, useEditorContext } from '@/contexts/EditorContext';
import { EditorHeader } from '@/components/Editor/EditorHeader/EditorHeader';
import { EditorCanvas } from '@/components/Editor/EditorCanvas/EditorCanvas';
import { EditorSidebar } from '@/components/Editor/EditorSidebar/EditorSidebar';
import { ItemPropertiesPanel } from '@/components/Editor/ItemPropertiesPanel';
import { DragOverlayPreview } from '@/components/Editor/Common/DragOverlayPreview';
import { gridToPixelPosition, pixelToGridPosition, clampToGridBounds, resolveCollisions } from '@/utils/template';
import { toast } from 'sonner';
import type { TemplateItem } from '@/types/api';

/**
 * Drag item data for DragOverlay
 * Discriminated union for staging items vs canvas items
 */
type DragItemData =
  | { type: 'staging-item'; item: TemplateItem }
  | (TemplateItem & { type?: 'canvas-item' });

const EditorContent = () => {
  const { state, dispatch } = useEditorContext();
  const [activeDragItem, setActiveDragItem] = useState<DragItemData | null>(null);

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

    // Store active drag data for overlay
    setActiveDragItem(event.active.data.current as DragItemData | null);

    // Check if it's a staging item (string id starting with 'staging-')
    if (typeof draggedId === 'string' && draggedId.startsWith('staging-')) {
      // Don't select staging items during drag
      return;
    }

    // Select canvas item
    dispatch({ type: 'SELECT_ITEM', payload: draggedId as number });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    // Clear active drag item
    setActiveDragItem(null);

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

    // Check if canvas item is dropped on staging area
    if (over && over.id === 'staging-area') {
      dispatch({ type: 'MOVE_TO_STAGING', payload: itemId });
      toast.info('아이템이 임시 저장 공간으로 이동되었습니다.');
      return;
    }

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

    // Immediately update the dragged item's position to prevent animation glitch
    dispatch({
      type: 'MOVE_ITEM',
      payload: {
        id: itemId,
        position: clampedPos,
      },
    });

    // Try to resolve collisions with other items
    const positionChanges = resolveCollisions(
      itemId,
      clampedPos,
      state.template.items
    );

    if (positionChanges) {
      // Check if there are no collisions (only the dragged item in the map)
      const hasCollisions = positionChanges.size > 1;

      if (!hasCollisions) {
        // No collisions: disable transition for instant snap
        dispatch({ type: 'SET_NO_TRANSITION_ITEM', payload: itemId });
        setTimeout(() => {
          dispatch({ type: 'CLEAR_NO_TRANSITION_ITEM' });
        }, 50);
      }

      // Apply position changes only for affected items (excluding the dragged item)
      positionChanges.forEach((newPos, affectedItemId) => {
        if (affectedItemId !== itemId) {
          dispatch({
            type: 'MOVE_ITEM',
            payload: {
              id: affectedItemId,
              position: newPos,
            },
          });
        }
      });

      // Show notification if items were pushed
      if (hasCollisions) {
        toast.info(`${positionChanges.size - 1}개의 아이템이 밀려났습니다`);
      }
    } else {
      // Collision resolution failed, revert to original position
      dispatch({
        type: 'MOVE_ITEM',
        payload: {
          id: itemId,
          position: item.position,
        },
      });
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

      {/* DragOverlay renders dragged items at root level, above all stacking contexts */}
      <DragOverlay>
        {activeDragItem && (
          <DragOverlayPreview
            item={activeDragItem.type === 'staging-item' ? activeDragItem.item : activeDragItem}
            type={activeDragItem.type === 'staging-item' ? 'staging-item' : 'canvas-item'}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
};

export const EditorPage = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const [searchParams] = useSearchParams();
  const startFrom = searchParams.get('from') as 'default' | 'empty' | null;

  return (
    <EditorProvider
      templateId={templateId ? parseInt(templateId) : undefined}
      startFrom={startFrom || undefined}
    >
      <EditorContent />
    </EditorProvider>
  );
};
