import type { TemplateSummary } from '@/types/api';
import { cn } from '@/lib/utils';
import { TemplatePreviewCanvas } from './TemplatePreviewCanvas';
import { Check, Loader2, Trash2 } from 'lucide-react';
import { UNSAVED_TEMPLATE_ID } from '@/constants/template';

interface TemplateCardProps {
  template: TemplateSummary;
  onClick?: () => void;
  className?: string;
  isSelected?: boolean;
  onApply?: (event: React.MouseEvent) => void;
  onDelete?: (event: React.MouseEvent) => void;
  showDelete?: boolean;
  isActionLoading?: boolean;
}

export const TemplateCard = ({
  template,
  onClick,
  className,
  isSelected,
  onApply,
  onDelete,
  showDelete = false,
  isActionLoading = false,
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

    <div className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1 space-y-1">
        <h4 className="truncate text-sm font-medium">{template.name}</h4>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{template.itemCount || 0} items</span>
          <span>{template.height}행</span>
        </div>
      </div>
      {(isActionLoading || onApply || (showDelete && onDelete)) && (
        <div className="flex shrink-0 gap-2">
          {isActionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {onApply &&
            (isSelected ? (
              <div
                className="rounded-md bg-primary p-2 text-primary-foreground"
                title="메인 화면에 적용됨"
              >
                <Check className="h-4 w-4" />
              </div>
            ) : (
              <button
                type="button"
                onClick={onApply}
                className="rounded-md bg-primary p-2 text-primary-foreground hover:bg-primary/90"
                title="메인 화면에 적용"
              >
                <Check className="h-4 w-4" />
              </button>
            ))}
          {showDelete &&
            template.templateId !== UNSAVED_TEMPLATE_ID &&
            onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-md bg-destructive p-2 text-destructive-foreground hover:bg-destructive/90"
                title="삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
        </div>
      )}
    </div>
  </div>
);
