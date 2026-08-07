"use client";

import { useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { Download, QrCode } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@linku/ui";
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
    <Card>
      <CardHeader>
        <CardTitle>{copy.qr.title}</CardTitle>
        <CardDescription className="leading-7">{copy.qr.description}</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-5">
        <div className="flex flex-col gap-3 md:flex-row">
        <Input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          aria-label={copy.qr.inputLabel}
          placeholder={copy.qr.placeholder}
        />
        <Button
          type="button"
          onClick={() => void generateQrCode()}
          disabled={loading}
        >
          <QrCode className="size-4" />
          {copy.qr.generate}
        </Button>
        </div>

      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex min-h-72 items-center justify-center rounded-lg border bg-muted/40 p-6">
        {qrDataUrl ? (
          <div className="flex flex-col items-center gap-4">
            <Image
              src={qrDataUrl}
              alt="LinKU QR"
              width={256}
              height={256}
              unoptimized
              className="h-64 w-64 rounded-lg border bg-background p-3"
            />
            <Button
              type="button"
              variant="outline"
              onClick={downloadQrCode}
            >
              <Download className="size-4" />
              {copy.qr.download}
            </Button>
          </div>
        ) : (
          <p className="max-w-sm text-center text-sm leading-7 text-muted-foreground">
            {copy.qr.empty}
          </p>
        )}
      </div>
      </CardContent>
    </Card>
  );
}
