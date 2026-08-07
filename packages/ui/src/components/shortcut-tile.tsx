import * as React from "react";

import { cn } from "../lib/utils";

function ShortcutGrid({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="shortcut-grid"
      className={cn("grid grid-cols-6 gap-3 border-t p-3", className)}
      {...props}
    />
  );
}

interface ShortcutTileProps {
  icon: React.ReactNode;
  label: React.ReactNode;
  wide?: boolean;
  className?: string;
  href?: string;
  target?: React.HTMLAttributeAnchorTarget;
  rel?: string;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
}

function ShortcutTile({
  icon,
  label,
  wide = false,
  className,
  href,
  target,
  rel,
  type = "button",
  onClick,
}: ShortcutTileProps) {
  const content = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-main/10 text-main">
        {icon}
      </span>
      <span className="w-full truncate text-center text-base text-black">
        {label}
      </span>
    </>
  );
  const classes = cn(
    wide ? "col-span-3" : "col-span-2",
    "flex min-h-14 items-center justify-start overflow-hidden rounded-lg border border-gray-200 px-4 py-2 transition-colors hover:bg-gray-100",
    className,
  );

  if (href) {
    return (
      <a
        data-slot="shortcut-tile"
        href={href}
        target={target}
        rel={rel}
        className={classes}
        onClick={onClick as React.MouseEventHandler<HTMLAnchorElement>}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      data-slot="shortcut-tile"
      type={type}
      className={classes}
      onClick={onClick as React.MouseEventHandler<HTMLButtonElement>}
    >
      {content}
    </button>
  );
}

export { ShortcutGrid, ShortcutTile };
