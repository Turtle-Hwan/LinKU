/**
 * Staging Item - Template item in staging area (temporary storage)
 * Can be dragged to canvas
 */

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { TemplateItem } from '@/types/api';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

interface StagingItemProps {
  item: TemplateItem;
  onDelete: (itemId: number) => void;
}

export const StagingItem = ({ item, onDelete }: StagingItemProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `staging-${item.templateItemId}`,
    data: {
      type: 'staging-item',
      item,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.templateItemId);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group border rounded-lg bg-white transition-all cursor-move',
        'hover:bg-gray-50 hover:border-primary',
        'border-gray-200',
        isDragging && 'opacity-50 shadow-lg'
      )}
      {...listeners}
      {...attributes}
    >
      {/* Item content - horizontal layout matching LinkGroup */}
      <div className="flex flex-row items-center justify-start px-3 py-2 gap-2">
        {/* Icon with circular background */}
        <div className="w-8 h-8 rounded-full bg-main/10 flex items-center justify-center shrink-0">
          <img
            src={item.icon.imageUrl}
            alt={item.icon.name}
            className="w-4 h-4 object-contain"
          />
        </div>
        {/* Name */}
        <span className="flex-1 text-sm text-black truncate">
          {item.name}
        </span>
      </div>

      {/* Delete button (appears on hover) */}
      <button
        onClick={handleDelete}
        className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity"
        title="삭제"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
};
