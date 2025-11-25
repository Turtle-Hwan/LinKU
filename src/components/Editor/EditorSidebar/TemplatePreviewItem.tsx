/**
 * Template Preview Item - Read-only version of DraggableItem for previews
 * Displays template items with same styling but half scale
 */

import type { TemplateItem } from '@/types/api';
import { gridToPixelPosition, gridToPixelSize } from '@/utils/template';
import { cn } from '@/lib/utils';

interface TemplatePreviewItemProps {
  item: TemplateItem;
  scale?: number;
}

export const TemplatePreviewItem = ({ item, scale = 1.0 }: TemplatePreviewItemProps) => {
  // Convert grid coordinates to pixel positions
  const pixelPos = gridToPixelPosition(item.position);
  const pixelSize = gridToPixelSize(item.size);

  const style = {
    position: 'absolute' as const,
    left: pixelPos.x * scale,
    top: pixelPos.y * scale,
    width: pixelSize.width * scale,
    height: pixelSize.height * scale,
  };

  return (
    <div
      style={style}
      className={cn(
        // Base styles matching DraggableItem
        'border rounded-lg bg-white',
        'border-gray-200',
        // No hover effects for preview
        'pointer-events-none',
      )}
    >
      {/* Horizontal layout matching DraggableItem */}
      <div
        className="flex flex-row items-center justify-start h-full gap-1.5 overflow-hidden"
        style={{
          padding: `${2 * scale}px ${4 * scale}px`,
        }}
      >
        {/* Icon with circular background */}
        <div
          className="rounded-full bg-main/10 flex items-center justify-center shrink-0"
          style={{
            width: 9 * scale * 4, // w-9 = 36px, scaled
            height: 9 * scale * 4,
          }}
        >
          <img
            src={item.icon.imageUrl}
            alt={item.icon.name}
            className="object-contain"
            style={{
              width: 5 * scale * 4, // w-5 = 20px, scaled
              height: 5 * scale * 4,
            }}
          />
        </div>
        {/* Name */}
        <span
          className="w-full text-black text-center truncate"
          style={{
            fontSize: `${16 * scale}px`, // text-base = 16px, scaled
          }}
        >
          {item.name}
        </span>
      </div>
    </div>
  );
};
