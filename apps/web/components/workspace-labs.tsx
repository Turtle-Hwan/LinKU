"use client";

import type { AppLocale } from "@/i18n/routing";
import { getLabsCopy } from "@/lib/labs-copy";
import { LabsLibrarySeats } from "@/components/labs-library-seats";
import { LabsQrGenerator } from "@/components/labs-qr-generator";
import { LabsServerClock } from "@/components/labs-server-clock";

export function WorkspaceLabs({ locale }: { locale: AppLocale }) {
  const copy = getLabsCopy(locale);

  return (
    <div className="space-y-8">
      <section className="rounded-[1.8rem] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(19,42,34,0.05)]">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">
          {copy.page.eyebrow}
        </p>
        <h1 data-display="true" className="mt-3 text-5xl tracking-[-0.05em]">
          {copy.page.title}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--muted)]">
          {copy.page.body}
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <LabsLibrarySeats locale={locale} />
        <LabsServerClock locale={locale} />
      </div>

      <LabsQrGenerator locale={locale} />
    </div>
  );
}
