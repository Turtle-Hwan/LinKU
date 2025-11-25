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
}

export const TemplateCard = ({ template, onClick, className }: TemplateCardProps) => {
  return (
    <div
      className={cn(
        'p-3 border rounded-lg transition-all',
        onClick && 'cursor-pointer hover:border-primary hover:shadow-sm',
        !onClick && 'cursor-default',
        className
      )}
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Preview Canvas */}
        {template.items && template.items.length > 0 && (
          <div className="flex justify-center">
            <TemplatePreviewCanvas
              items={template.items}
              height={template.height}
            />
          </div>
        )}

        {/* Template Info */}
        <div className="space-y-1">
          <h4 className="font-medium text-sm truncate">{template.name}</h4>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{template.itemCount || 0} items</span>
            <span>{template.height}행</span>
          </div>
        </div>
      </div>
    </div>
  );
};
