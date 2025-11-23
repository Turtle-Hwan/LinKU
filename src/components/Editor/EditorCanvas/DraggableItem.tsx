/**
 * Draggable Item - Template item that can be dragged and selected
 * Converts grid coordinates to pixel positions for rendering
 * Supports resizing via handle on selected items
 */

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useState, useRef, useEffect } from 'react';
import type { TemplateItem } from '@/types/api';
import { useEditorContext } from '@/contexts/EditorContext';
import { cn } from '@/lib/utils';
import { gridToPixelPosition, gridToPixelSize, pixelToGridSize, clampToGridBounds, GRID_CONFIG } from '@/utils/template';
import { Maximize2, Trash2 } from 'lucide-react';

interface DraggableItemProps {
  item: TemplateItem;
  isSelected: boolean;
}

export const DraggableItem = ({ item, isSelected }: DraggableItemProps) => {
  const { dispatch } = useEditorContext();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.templateItemId,
    data: item, // Pass item data for DragOverlay
  });

  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);

  // Convert grid coordinates to pixel positions for rendering
  const pixelPos = gridToPixelPosition(item.position);
  const pixelSize = gridToPixelSize(item.size);

  const style = {
    position: 'absolute' as const,
    left: pixelPos.x,
    top: pixelPos.y,
    width: pixelSize.width,
    height: pixelSize.height,
    transform: CSS.Translate.toString(transform),
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'SELECT_ITEM', payload: item.templateItemId });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: 'MOVE_TO_STAGING', payload: item.templateItemId });
  };

  const handleDeletePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: pixelSize.width,
      startHeight: pixelSize.height,
    };
  };

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;

      const deltaX = e.clientX - resizeStartRef.current.startX;
      const deltaY = e.clientY - resizeStartRef.current.startY;

      const newWidth = Math.max(GRID_CONFIG.CELL_WIDTH_PX, resizeStartRef.current.startWidth + deltaX);
      const newHeight = Math.max(GRID_CONFIG.CELL_HEIGHT_PX, resizeStartRef.current.startHeight + deltaY);

      // Convert to grid size
      const newGridSize = pixelToGridSize({ width: newWidth, height: newHeight });

      // Check if new size would fit within grid bounds
      const clampedPos = clampToGridBounds(item.position, newGridSize);

      // Only update if position hasn't changed (size fits)
      if (clampedPos.x === item.position.x && clampedPos.y === item.position.y) {
        dispatch({
          type: 'RESIZE_ITEM',
          payload: {
            id: item.templateItemId,
            size: newGridSize,
          },
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, item.templateItemId, item.position, dispatch]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        // Base styles matching LinkGroup GridItem
        'border rounded-lg bg-white',
        // Only apply transitions when not dragging or resizing
        !isDragging && !isResizing && 'transition-all',
        // Cursor changes based on state
        isResizing ? 'cursor-se-resize' : 'cursor-move',
        'hover:bg-gray-100',
        // Selected state
        isSelected && 'border-primary ring-2 ring-primary/20',
        !isSelected && 'border-gray-200',
        // Dragging state (only when not resizing)
        isDragging && !isResizing && 'opacity-50 shadow-lg'
      )}
      onClick={handleClick}
      {...(!isResizing && listeners)}
      {...attributes}
    >
      {/* Horizontal layout matching LinkGroup GridItem */}
      <div className="flex flex-row items-center justify-start px-4 py-2 h-full gap-3">
        {/* Icon with circular background */}
        <div className="w-9 h-9 rounded-full bg-main/10 flex items-center justify-center shrink-0">
          <img
            src={item.icon.imageUrl}
            alt={item.icon.name}
            className="w-5 h-5 object-contain"
          />
        </div>
        {/* Name */}
        <span className="w-full text-base text-black text-center break-keep">
          {item.name}
        </span>
      </div>

      {/* Delete button - only shown when selected */}
      {isSelected && (
        <button
          onClick={handleDelete}
          onPointerDown={handleDeletePointerDown}
          className="absolute top-0 right-0 w-6 h-6 flex items-center justify-center bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors z-10"
          title="캔버스에서 제거 (임시 저장 공간으로 이동)"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {/* Resize handle - only shown when selected */}
      {isSelected && (
        <div
          onMouseDown={handleResizeStart}
          onPointerDown={handleResizePointerDown}
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          title="크기 조절"
        >
          <Maximize2 className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};
