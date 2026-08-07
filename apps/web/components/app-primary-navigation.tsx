"use client";

import { cn } from "@linku/ui";
import { Link, usePathname } from "@/i18n/navigation";
import type { LocalizedPageSummary } from "@/lib/site";

interface AppPrimaryNavigationProps {
  items: LocalizedPageSummary[];
  label: string;
}

export function AppPrimaryNavigation({
  items,
  label,
}: AppPrimaryNavigationProps) {
  const pathname = usePathname();

  return (
    <nav
      className="overflow-x-auto border-t px-4 py-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-3 sm:py-3 [&::-webkit-scrollbar]:hidden"
      aria-label={label}
    >
      <div className="grid min-w-[720px] grid-cols-7 rounded-lg bg-muted p-[3px] text-sm text-muted-foreground">
        {items.map((item) => {
          const active =
            pathname === item.path || pathname.startsWith(`${item.path}/`);

          return (
            <Link
              key={item.slug}
              href={item.path}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-md px-2 font-medium transition-colors hover:bg-white hover:text-foreground",
                active && "bg-white text-foreground shadow-xs",
              )}
            >
              {item.title}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
