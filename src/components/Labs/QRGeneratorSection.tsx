import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Info, Download } from "lucide-react";
import QRCode from "qrcode";

const QRGeneratorSection = () => {
  const [url, setUrl] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!url.trim()) {
      setQrDataUrl("");
      setError("");
      return;
    }

    // URL 유효성 검사
    try {
      new URL(url);
    } catch {
      setError("올바른 URL 형식이 아닙니다");
      setQrDataUrl("");
      return;
    }

    // QR 코드 생성
    QRCode.toDataURL(url, {
      width: 200,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    })
      .then((dataUrl) => {
        setQrDataUrl(dataUrl);
        setError("");
      })
      .catch(() => {
        setError("QR 코드 생성에 실패했습니다");
        setQrDataUrl("");
      });
  }, [url]);

  const handleDownload = () => {
    if (!qrDataUrl) return;

    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = "linku_qr.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      <h2 className="text-base font-semibold">QR 코드 생성</h2>

      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            URL을 입력하면 QR 코드로 변환합니다.
          </p>
        </div>

        <Input
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        {error && <p className="text-xs text-red-500">{error}</p>}

        {qrDataUrl && (
          <div className="flex flex-col items-center gap-3 py-4">
            <img
              src={qrDataUrl}
              alt="QR Code"
              className="border rounded-lg shadow-sm"
            />
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              다운로드
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRGeneratorSection;
