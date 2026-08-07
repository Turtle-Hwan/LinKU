"use client";

import type { AppLocale } from "@/i18n/routing";
import { getLabsCopy } from "@/lib/labs-copy";
import { LabsLibrarySeats } from "@/components/labs-library-seats";
import { LabsQrGenerator } from "@/components/labs-qr-generator";
import { LabsServerClock } from "@/components/labs-server-clock";
import { WorkspacePageHeading } from "@/components/workspace-page-heading";

export function WorkspaceLabs({ locale }: { locale: AppLocale }) {
  const copy = getLabsCopy(locale);

  return (
    <div className="flex flex-col gap-6">
      <WorkspacePageHeading
        eyebrow={copy.page.eyebrow}
        title={copy.page.title}
        description={copy.page.body}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <LabsLibrarySeats locale={locale} />
        <LabsServerClock locale={locale} />
      </div>

      <LabsQrGenerator locale={locale} />
    </div>
  );
}
