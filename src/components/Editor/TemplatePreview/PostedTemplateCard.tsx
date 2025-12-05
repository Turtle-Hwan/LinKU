/**
 * Posted Template Card - Preview card for posted templates in gallery
 * Shows author info, like/clone counts, and action buttons
 */

import type { PostedTemplateSummary, PreviewableItem } from '@/types/api';
import { cn } from '@/lib/utils';
import { TemplatePreviewCanvas } from './TemplatePreviewCanvas';
import { Heart, Copy, Trash2, User } from 'lucide-react';

interface PostedTemplateCardProps {
  template: PostedTemplateSummary;
  /** Optional items for preview rendering (if available from API) */
  items?: PreviewableItem[];
  /** Template height for preview canvas */
  height?: number;
  onClick?: () => void;
  onClone?: () => void;
  onLike?: () => void;
  onUnpost?: () => void;
  /** Whether current user is the author */
  isOwner?: boolean;
  /** Whether user is logged in (actions require login) */
  isLoggedIn?: boolean;
  className?: string;
  /** Whether clone/like actions are loading */
  isLoading?: boolean;
}

export const PostedTemplateCard = ({
  template,
  items,
  height = 6,
  onClick,
  onClone,
  onLike,
  onUnpost,
  isOwner = false,
  isLoggedIn = false,
  className,
  isLoading = false,
}: PostedTemplateCardProps) => {
  const handleClone = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClone?.();
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    onLike?.();
  };

  const handleUnpost = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUnpost?.();
  };

  return (
    <div
      className={cn(
        'relative group border rounded-lg transition-all w-[500px] overflow-hidden bg-background',
        onClick && 'cursor-pointer hover:border-primary hover:shadow-sm',
        !onClick && 'cursor-default',
        className
      )}
      onClick={onClick}
    >
      {/* Preview */}
      {items && items.length > 0 ? (
        <TemplatePreviewCanvas items={items} height={height} />
      ) : template.previewUrl ? (
        <div className="relative w-full aspect-[500/300] bg-muted">
          <img
            src={template.previewUrl}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="relative w-full aspect-[500/300] bg-muted flex items-center justify-center">
          <span className="text-xs text-muted-foreground">미리보기 없음</span>
        </div>
      )}

      {/* Template Info */}
      <div className="px-3 py-2 space-y-2">
        {/* Name */}
        <h4 className="font-medium text-sm truncate">{template.name}</h4>

        {/* Author */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
            <User className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="text-xs text-muted-foreground truncate">
            {template.ownerName ?? '알 수 없음'}
          </span>
        </div>

        {/* Stats & Actions */}
        <div className="flex items-center justify-between">
          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <button
              onClick={handleLike}
              disabled={!isLoggedIn || isLoading}
              className={cn(
                'flex items-center gap-1 transition-colors',
                isLoggedIn && !isLoading && 'hover:text-red-500 cursor-pointer',
                (!isLoggedIn || isLoading) && 'cursor-not-allowed opacity-60',
                template.isLiked && 'text-red-500'
              )}
              title={isLoggedIn ? (template.isLiked ? '좋아요 취소' : '좋아요') : '로그인 필요'}
            >
              <Heart
                className={cn('h-4 w-4', template.isLiked && 'fill-current')}
              />
              <span>{template.likesCount}</span>
            </button>

            <div className="flex items-center gap-1">
              <Copy className="h-4 w-4" />
              <span>{template.usageCount}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Clone Button */}
            {onClone && (
              <button
                onClick={handleClone}
                disabled={!isLoggedIn || isLoading}
                className={cn(
                  'px-2 py-1 text-xs rounded-md transition-colors',
                  isLoggedIn && !isLoading
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
                title={isLoggedIn ? '내 템플릿으로 복제' : '로그인 필요'}
              >
                복제
              </button>
            )}

            {/* Unpost Button (owner only) */}
            {isOwner && onUnpost && (
              <button
                onClick={handleUnpost}
                disabled={isLoading}
                className={cn(
                  'p-1 rounded-md transition-colors',
                  'bg-destructive/10 text-destructive hover:bg-destructive/20',
                  isLoading && 'opacity-50 cursor-not-allowed'
                )}
                title="게시 취소"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
