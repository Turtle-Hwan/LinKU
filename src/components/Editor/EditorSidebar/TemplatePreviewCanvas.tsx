/**
 * Template Preview Canvas - Read-only mini canvas for template previews
 * Renders template layout at half scale
 */

import type { TemplateItem } from '@/types/api';
import { TemplatePreviewItem } from './TemplatePreviewItem';
import { GRID_CONFIG } from '@/utils/template';

interface TemplatePreviewCanvasProps {
  items: TemplateItem[];
  height: number;
  loading?: boolean;
}

export const TemplatePreviewCanvas = ({ items, height, loading }: TemplatePreviewCanvasProps) => {
  const scale = 0.5;
  const canvasWidth = GRID_CONFIG.CANVAS_WIDTH_PX * scale;
  const canvasHeight = GRID_CONFIG.CANVAS_HEIGHT_PX * scale * (height / GRID_CONFIG.ROWS);

  if (loading) {
    return (
      <div
        className="relative bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center"
        style={{
          width: canvasWidth,
          height: canvasHeight,
        }}
      >
        <span className="text-xs text-gray-400">로딩 중...</span>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div
        className="relative bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center"
        style={{
          width: canvasWidth,
          height: canvasHeight,
        }}
      >
        <span className="text-xs text-gray-400">아이템 없음</span>
      </div>
    );
  }

  return (
    <div
      className="relative bg-white rounded-lg border border-gray-200"
      style={{
        width: canvasWidth,
        height: canvasHeight,
      }}
    >
      {/* Grid background (optional) */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(to right, #000 1px, transparent 1px),
            linear-gradient(to bottom, #000 1px, transparent 1px)
          `,
          backgroundSize: `${GRID_CONFIG.CELL_WIDTH_PX * scale}px ${GRID_CONFIG.CELL_HEIGHT_PX * scale}px`,
          backgroundPosition: `${GRID_CONFIG.PADDING_PX * scale}px ${GRID_CONFIG.PADDING_PX * scale}px`,
        }}
      />

      {/* Items */}
      {items.map((item) => (
        <TemplatePreviewItem key={item.templateItemId} item={item} scale={scale} />
      ))}
    </div>
  );
};
