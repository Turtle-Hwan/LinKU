import { createPageMetadata } from "@linku/seo";
import { auth, authRuntime } from "@/auth";
import { siteEnv } from "@/lib/site";

export const metadata = createPageMetadata({
  title: "Account",
  description: "Review session identity, provider readiness, and canonical-domain account details for LinKU.",
  path: "/account",
  siteUrl: siteEnv.siteUrl,
  index: false,
});

export default async function AccountPage() {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Account</p>
        <h1 data-display="true" className="text-5xl tracking-[-0.05em]">
          Session identity and provider readiness on one canonical host.
        </h1>
        <p className="max-w-3xl text-lg leading-8 text-[var(--muted)]">
          This page keeps the account basics visible while OAuth secrets and extension identifiers may still be
          supplied later through environment configuration.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[1.4rem] border border-black/8 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">User</p>
          <h2 className="mt-3 text-2xl tracking-[-0.04em]">{user?.name || "Signed-in user"}</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">{user?.email || "No email available"}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Session user ID: {user?.id || "not available"}</p>
        </article>

        <article className="rounded-[1.4rem] border border-black/8 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Environment</p>
          <h2 className="mt-3 text-2xl tracking-[-0.04em]">Auth runtime</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Canonical site: {siteEnv.siteUrl}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Google OAuth ready: {authRuntime.googleConfigured ? "yes" : "no"}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Extension ID: {siteEnv.extensionId}</p>
        </article>
      </div>
    </div>
  );
}
