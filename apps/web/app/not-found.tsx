import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-start justify-center gap-6 px-6 py-16">
      <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">404</p>
      <h1 data-display="true" className="text-6xl leading-[0.95] tracking-[-0.05em]">
        This route does not exist.
      </h1>
      <p className="max-w-xl text-lg leading-8 text-[var(--muted)]">
        Try the main landing page, install guide, feature pages, service landing pages, or the login entry route.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="rounded-full border border-black/10 px-5 py-3">
          Back home
        </Link>
        <Link href="/login" className="rounded-full border border-black/10 px-5 py-3">
          Go to login
        </Link>
      </div>
    </section>
  );
}
