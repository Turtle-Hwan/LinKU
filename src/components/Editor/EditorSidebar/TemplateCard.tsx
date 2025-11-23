/**
 * Template Card - Preview card for template in lists
 */

import type { TemplateSummary } from '@/types/api';
import { cn } from '@/lib/utils';

interface TemplateCardProps {
  template: TemplateSummary;
  onClick?: () => void;
  className?: string;
}

export const TemplateCard = ({ template, onClick, className }: TemplateCardProps) => {
  return (
    <div
      className={cn(
        'p-3 border rounded-lg cursor-pointer transition-all',
        'hover:border-primary hover:shadow-sm',
        className
      )}
      onClick={onClick}
    >
      <div className="space-y-2">
        <h4 className="font-medium text-sm truncate">{template.name}</h4>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{template.itemCount || 0} items</span>
          <span>{template.height}px</span>
        </div>
      </div>
    </div>
  );
};
