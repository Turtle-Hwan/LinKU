/**
 * Icon Grid Component
 * Reusable icon selection grid for both dialog and panel
 */

import type { Icon } from '@/types/api';
import { cn } from '@/lib/utils';

interface IconGridProps {
  icons: Icon[];
  selectedIconId: number | null;
  onSelectIcon: (iconId: number) => void;
  columns?: 4 | 8;
  maxHeight?: string;
  emptyMessage?: string;
}

export const IconGrid = ({
  icons,
  selectedIconId,
  onSelectIcon,
  columns = 4,
  maxHeight = 'max-h-48',
  emptyMessage = '아이콘이 없습니다',
}: IconGridProps) => {
  const gridCols = columns === 8 ? 'grid-cols-8' : 'grid-cols-4';
  const colSpan = columns === 8 ? 'col-span-8' : 'col-span-4';
  const buttonSize = columns === 8 ? 'w-12 h-12' : 'aspect-square';

  return (
    <div
      className={cn(
        'grid gap-2 overflow-y-auto p-2 border rounded-md',
        gridCols,
        maxHeight
      )}
    >
      {icons.length === 0 ? (
        <div className={cn('flex items-center justify-center py-4', colSpan)}>
          <p className="text-xs text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        icons.map((icon) => (
          <button
            key={icon.id}
            onClick={() => onSelectIcon(icon.id)}
            className={cn(
              'p-2 rounded-md border-2 transition-all',
              buttonSize,
              selectedIconId === icon.id
                ? 'border-primary bg-primary/10'
                : 'border-transparent hover:border-gray-300'
            )}
            title={icon.name}
            type="button"
          >
            <img
              src={icon.imageUrl}
              alt={icon.name}
              className="w-full h-full object-contain"
            />
          </button>
        ))
      )}
    </div>
  );
};
