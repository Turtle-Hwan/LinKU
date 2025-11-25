/**
 * Template Card - Preview card for template in lists
 */

import type { TemplateSummary } from '@/types/api';
import { cn } from '@/lib/utils';
import { TemplatePreviewCanvas } from './TemplatePreviewCanvas';

interface TemplateCardProps {
  template: TemplateSummary;
  onClick?: () => void;
  className?: string;
  isSelected?: boolean;
}

export const TemplateCard = ({ template, onClick, className, isSelected }: TemplateCardProps) => {
  return (
    <div
      className={cn(
        'border rounded-lg transition-all min-w-[550px] overflow-hidden',
        onClick && 'cursor-pointer hover:border-primary hover:shadow-sm',
        !onClick && 'cursor-default',
        isSelected && 'ring-2 ring-primary',
        className
      )}
      onClick={onClick}
    >
      {/* Preview Canvas - no padding */}
      {template.items && template.items.length > 0 && (
        <div className="flex justify-center">
          <TemplatePreviewCanvas
            items={template.items}
            height={template.height}
          />
        </div>
      )}

      {/* Template Info - with padding */}
      <div className="px-3 py-2 space-y-1">
        <h4 className="font-medium text-sm truncate">{template.name}</h4>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{template.itemCount || 0} items</span>
          <span>{template.height}행</span>
        </div>
      </div>
    </div>
  );
};
