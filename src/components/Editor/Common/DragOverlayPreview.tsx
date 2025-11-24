/**
 * Drag Overlay Preview Component
 * Renders preview for dragged items (staging or canvas)
 */

import type { TemplateItem } from '@/types/api';

interface DragOverlayPreviewProps {
  item: TemplateItem | null;
  type: 'staging-item' | 'canvas-item';
}

export const DragOverlayPreview = ({ item, type }: DragOverlayPreviewProps) => {
  if (!item) return null;

  if (type === 'staging-item') {
    return (
      <div className="border rounded-lg bg-white shadow-xl opacity-90">
        <div className="flex flex-row items-center justify-start px-3 py-2 gap-2">
          <div className="w-8 h-8 rounded-full bg-main/10 flex items-center justify-center shrink-0">
            <img
              src={item.icon.imageUrl}
              alt={item.icon.name}
              className="w-4 h-4 object-contain"
            />
          </div>
          <span className="flex-1 text-sm text-black truncate">
            {item.name}
          </span>
        </div>
      </div>
    );
  }

  // Canvas item preview
  return (
    <div className="border border-primary rounded-lg bg-white shadow-xl opacity-90 px-4 py-2">
      <div className="flex flex-row items-center justify-start gap-3">
        <div className="w-9 h-9 rounded-full bg-main/10 flex items-center justify-center shrink-0">
          <img
            src={item.icon.imageUrl}
            alt={item.icon.name}
            className="w-5 h-5 object-contain"
          />
        </div>
        <span className="text-base text-black">
          {item.name}
        </span>
      </div>
    </div>
  );
};
