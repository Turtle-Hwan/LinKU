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
      <div className="flex min-h-40 items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
        No items yet
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-lg border bg-muted/40"
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
          <div className="flex h-full items-center gap-3 rounded-md border bg-card px-3 py-2 shadow-sm">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary">
              <img
                src={item.icon.iconUrl}
                alt={item.icon.iconName}
                className="h-5 w-5 object-contain"
              />
            </div>
            <span className="line-clamp-2 text-sm leading-5 text-foreground">
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
