"use client";

import Link from "next/link";
import { Button } from "@linku/ui";

interface CtaLinkProps {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
  external?: boolean;
}

export function CtaLink({
  href,
  children,
  variant = "default",
  external = false,
}: CtaLinkProps) {
  if (external) {
    return (
      <Button asChild variant={variant} className="rounded-full px-5">
        <a href={href} target="_blank" rel="noreferrer">
          {children}
        </a>
      </Button>
    );
  }

  return (
    <Button asChild variant={variant} className="rounded-full px-5">
      <Link href={href}>{children}</Link>
    </Button>
  );
}
