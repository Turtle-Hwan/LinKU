"use client";

import { Button } from "@linku/ui";
import { Link } from "@/i18n/navigation";

interface CtaLinkProps {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
  external?: boolean;
  className?: string;
}

export function CtaLink({
  href,
  children,
  variant = "default",
  external = false,
  className = "",
}: CtaLinkProps) {
  if (external) {
    return (
      <Button asChild variant={variant} className={className}>
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      </Button>
    );
  }

  return (
    <Button asChild variant={variant} className={className}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
