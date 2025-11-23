/**
 * Draggable Item - Template item that can be dragged and selected
 * Converts grid coordinates to pixel positions for rendering
 */

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { TemplateItem } from '@/types/api';
import { useEditorContext } from '@/contexts/EditorContext';
import { cn } from '@/lib/utils';
import { gridToPixelPosition, gridToPixelSize } from '@/utils/template';

interface DraggableItemProps {
  item: TemplateItem;
  isSelected: boolean;
}

export const DraggableItem = ({ item, isSelected }: DraggableItemProps) => {
  const { dispatch } = useEditorContext();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.templateItemId,
  });

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border-2 rounded-lg bg-white shadow-sm transition-all cursor-move',
        'hover:shadow-md',
        isSelected && 'border-primary ring-2 ring-primary/20',
        !isSelected && 'border-gray-300',
        isDragging && 'opacity-50'
      )}
      onClick={handleClick}
      {...listeners}
      {...attributes}
    >
      <div className="p-4 flex flex-col items-center gap-2 h-full justify-center">
        <img
          src={item.icon.iconUrl}
          alt={item.icon.iconName}
          className="w-12 h-12 object-contain"
        />
        <span className="text-sm font-medium truncate w-full text-center">
          {item.name}
        </span>
      </div>
    </div>
  );
};
