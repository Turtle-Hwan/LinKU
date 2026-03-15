"use client";

/* eslint-disable @next/next/no-img-element */

import type { PostedTemplateItem, TemplateItem } from "@linku/shared-types";

type PreviewItem = TemplateItem | PostedTemplateItem;

interface WorkspaceTemplateGridProps {
  items: PreviewItem[];
  rows?: number;
  interactive?: boolean;
}

function clampRows(value: number) {
  return Math.max(1, Math.min(12, value));
}

export function WorkspaceTemplateGrid({
  items,
  rows = 6,
  interactive = false,
}: WorkspaceTemplateGridProps) {
  const resolvedRows = clampRows(rows);

  if (items.length === 0) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-[1.2rem] border border-dashed border-black/10 bg-[#f6f0e1] text-sm text-[var(--muted)]">
        No items yet
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-[1.4rem] border border-black/8 bg-[#f9f7f1]"
      style={{ aspectRatio: `6 / ${resolvedRows}` }}
    >
      {items.map((item, index) => {
        const itemStyle = {
          left: `${(item.position.x / 6) * 100}%`,
          top: `${(item.position.y / resolvedRows) * 100}%`,
          width: `${(item.size.width / 6) * 100}%`,
          height: `${(item.size.height / resolvedRows) * 100}%`,
        };

        const body = (
          <div className="flex h-full items-center gap-3 rounded-[1rem] border border-black/8 bg-white px-3 py-2 shadow-[0_10px_24px_rgba(19,42,34,0.08)]">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#d8f279]/40">
              <img
                src={item.icon.iconUrl}
                alt={item.icon.iconName}
                className="h-5 w-5 object-contain"
              />
            </div>
            <span className="line-clamp-2 text-sm leading-5 text-[var(--ink)]">
              {item.name}
            </span>
          </div>
        );

        return interactive ? (
          <a
            key={`${item.name}-${index}`}
            href={item.siteUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute block p-2"
            style={itemStyle}
          >
            {body}
          </a>
        ) : (
          <div
            key={`${item.name}-${index}`}
            className="absolute p-2"
            style={itemStyle}
          >
            {body}
          </div>
        );
      })}
    </div>
  );
}
