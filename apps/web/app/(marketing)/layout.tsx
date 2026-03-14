import { SiteShell } from "@/components/site-shell";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SiteShell>{children}</SiteShell>;
}
