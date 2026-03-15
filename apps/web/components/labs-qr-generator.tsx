"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { Download, QrCode } from "lucide-react";
import { Button, Input } from "@linku/ui";
import type { AppLocale } from "@/i18n/routing";
import { getLabsCopy } from "@/lib/labs-copy";

export function LabsQrGenerator({ locale }: { locale: AppLocale }) {
  const copy = getLabsCopy(locale);
  const [inputValue, setInputValue] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateQrCode() {
    if (!inputValue.trim()) {
      setQrDataUrl("");
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const dataUrl = await QRCode.toDataURL(inputValue.trim(), {
        width: 320,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(dataUrl);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to generate QR code.",
      );
      setQrDataUrl("");
    } finally {
      setLoading(false);
    }
  }

  function downloadQrCode() {
    if (!qrDataUrl) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = "linku-qr.png";
    anchor.click();
  }

  return (
    <section className="rounded-[1.6rem] border border-black/8 bg-white p-6">
      <div className="space-y-2">
        <h2 className="text-2xl tracking-[-0.04em]">{copy.qr.title}</h2>
        <p className="text-sm leading-7 text-[var(--muted)]">{copy.qr.description}</p>
      </div>

      <div className="mt-5 flex flex-col gap-3 md:flex-row">
        <Input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          aria-label={copy.qr.inputLabel}
          placeholder={copy.qr.placeholder}
          className="rounded-full bg-[#f6f0e1]"
        />
        <Button
          type="button"
          className="rounded-full"
          onClick={() => void generateQrCode()}
          disabled={loading}
        >
          <QrCode className="size-4" />
          {copy.qr.generate}
        </Button>
      </div>

      {error ? (
        <p className="mt-4 rounded-[1rem] border border-[#d18d7b] bg-[#fff3ef] p-4 text-sm text-[#8a3d2c]">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex min-h-72 items-center justify-center rounded-[1.4rem] border border-dashed border-black/10 bg-[#f6f0e1] p-6">
        {qrDataUrl ? (
          <div className="flex flex-col items-center gap-4">
            <img
              src={qrDataUrl}
              alt="LinKU QR"
              className="h-64 w-64 rounded-[1rem] border border-black/8 bg-white p-3"
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={downloadQrCode}
            >
              <Download className="size-4" />
              {copy.qr.download}
            </Button>
          </div>
        ) : (
          <p className="max-w-sm text-center text-sm leading-7 text-[var(--muted)]">
            {copy.qr.empty}
          </p>
        )}
      </div>
    </section>
  );
}
