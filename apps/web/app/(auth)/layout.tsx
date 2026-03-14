import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(216,242,121,0.25),transparent_28%),linear-gradient(180deg,#132a22_0%,#17352a_50%,#f4efe3_220%)] text-[#f7f2e8]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-lg font-semibold tracking-[-0.04em]">
            LinKU
          </Link>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <Link href="/install">Install</Link>
            <Link href="/guides/install-extension">Guide</Link>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
