/**
 * Template Card - Preview card for template in lists
 */

import type { TemplateSummary } from '@/types/api';
import { cn } from '@/lib/utils';
import { TemplatePreviewCanvas } from './TemplatePreviewCanvas';
import { Check, CloudUpload, Cloud, Trash2, Share2 } from 'lucide-react';

interface TemplateCardProps {
  template: TemplateSummary;
  onClick?: () => void;
  className?: string;
  isSelected?: boolean;
  onApply?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  onSync?: (e: React.MouseEvent) => void;
  onPublish?: (e: React.MouseEvent) => void;
  showDelete?: boolean;
  needsSync?: boolean;  // 로컬과 서버 데이터가 다를 때 true
}

export const TemplateCard = ({
  template,
  onClick,
  className,
  isSelected,
  onApply,
  onDelete,
  onSync,
  onPublish,
  showDelete = false,
  needsSync = false,
}: TemplateCardProps) => {
  return (
    <div
      className={cn(
        'relative group border rounded-lg transition-all w-[500px] overflow-hidden',
        onClick && 'cursor-pointer hover:border-primary hover:shadow-sm',
        !onClick && 'cursor-default',
        isSelected && 'ring-2 ring-primary',
        className
      )}
      onClick={onClick}
    >
      {/* Preview Canvas - no padding */}
      {template.items && template.items.length > 0 && (
        <TemplatePreviewCanvas
          items={template.items}
          height={template.height}
        />
      )}

      {/* Template Info - with padding */}
      <div className="px-3 py-2 space-y-1">
        <h4 className="font-medium text-sm truncate">{template.name}</h4>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{template.itemCount || 0} items</span>
          <span>{template.height}행</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className={cn(
        "absolute top-2 right-2 flex gap-2 transition-opacity",
        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        {/* Sync button - show for local-only OR needsSync (local changes pending) */}
        {template.templateId !== 0 && (template.syncStatus === 'local' || needsSync) && onSync && (
          <button
            onClick={onSync}
            className="p-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700"
            title={template.syncStatus === 'local' ? '서버에 동기화' : '변경사항 업로드'}
          >
            <CloudUpload className="h-4 w-4" />
          </button>
        )}
        {/* Synced badge - only show when fully synced (no pending changes) */}
        {template.templateId !== 0 && template.syncStatus === 'synced' && !needsSync && (
          <div className="p-2 bg-green-600 text-white rounded-md shadow-sm" title="동기화됨">
            <Cloud className="h-4 w-4" />
          </div>
        )}
        {/* Publish button - show for synced templates */}
        {template.templateId !== 0 && template.syncStatus === 'synced' && onPublish && (
          <button
            onClick={onPublish}
            className="p-2 bg-purple-600 text-white rounded-md shadow-sm hover:bg-purple-700"
            title="갤러리에 게시"
          >
            <Share2 className="h-4 w-4" />
          </button>
        )}

        {/* Apply button */}
        {onApply && (
          !isSelected ? (
            <button
              onClick={onApply}
              className="p-2 bg-primary text-primary-foreground rounded-md shadow-sm hover:bg-primary/90"
              title="메인 화면에 적용"
            >
              <Check className="h-4 w-4" />
            </button>
          ) : (
            <div className="p-2 bg-primary text-primary-foreground rounded-md shadow-sm">
              <Check className="h-4 w-4" />
            </div>
          )
        )}

        {/* Delete button (owned only) - hide for default template */}
        {showDelete && template.templateId !== 0 && onDelete && (
          <button
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
};
