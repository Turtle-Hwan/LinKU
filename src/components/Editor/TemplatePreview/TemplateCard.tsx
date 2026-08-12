import type { TemplateSummary } from '@/types/api';
import { cn } from '@/lib/utils';
import { TemplatePreviewCanvas } from './TemplatePreviewCanvas';
import { Check, HardDrive, Trash2 } from 'lucide-react';

interface TemplateCardProps {
  template: TemplateSummary;
  onClick?: () => void;
  className?: string;
  isSelected?: boolean;
  onApply?: (event: React.MouseEvent) => void;
  onDelete?: (event: React.MouseEvent) => void;
  showDelete?: boolean;
}

export const TemplateCard = ({
  template,
  onClick,
  className,
  isSelected,
  onApply,
  onDelete,
  showDelete = false,
}: TemplateCardProps) => (
  <div
    className={cn(
      'relative group border rounded-lg transition-all w-[500px] overflow-hidden',
      onClick && 'cursor-pointer hover:border-primary hover:shadow-sm',
      !onClick && 'cursor-default',
      isSelected && 'ring-2 ring-primary',
      className,
    )}
    onClick={onClick}
  >
    {template.items && template.items.length > 0 && (
      <TemplatePreviewCanvas items={template.items} height={template.height} />
    )}

    <div className="px-3 py-2 space-y-1">
      <h4 className="font-medium text-sm truncate">{template.name}</h4>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{template.itemCount || 0} items</span>
        <span>{template.height}행</span>
      </div>
    </div>

    <div
      className={cn(
        'absolute top-2 right-2 flex gap-2 transition-opacity',
        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}
    >
      {template.templateId !== 0 && (
        <div
          className="rounded-md bg-background/95 p-2 text-muted-foreground shadow-sm"
          title="이 기기에 저장됨"
        >
          <HardDrive className="h-4 w-4" />
        </div>
      )}
      {onApply &&
        (isSelected ? (
          <div className="p-2 bg-primary text-primary-foreground rounded-md shadow-sm">
            <Check className="h-4 w-4" />
          </div>
        ) : (
          <button
            type="button"
            onClick={onApply}
            className="p-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:bg-primary/90"
            title="메인 화면에 적용"
          >
            <Check className="h-4 w-4" />
          </button>
        ))}
      {showDelete && template.templateId !== 0 && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="p-2 bg-destructive text-destructive-foreground rounded-md shadow-sm hover:bg-destructive/90"
          title="삭제"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  </div>
);
