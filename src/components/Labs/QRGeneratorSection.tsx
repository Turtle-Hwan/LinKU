import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Info, Download, Check, Upload, X } from "lucide-react";
import QRCode from "qrcode";

// LinKU 로고 (public/assets/icon128.png) - 고해상도 사용
const LINKU_LOGO_URL = "/assets/icon128.png";

type LogoOption = "none" | "linku" | "custom";

const QRGeneratorSection = () => {
  const [inputUrl, setInputUrl] = useState<string>("");
  const [activeUrl, setActiveUrl] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // 로고 관련 상태
  const [logoOption, setLogoOption] = useState<LogoOption>("linku");
  const [customLogoUrl, setCustomLogoUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 이미지 로드 헬퍼
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  // QR 코드에 로고 오버레이
  const generateQRWithLogo = useCallback(
    async (url: string, logoSrc: string | null): Promise<string> => {
      const canvas = document.createElement("canvas");
      // 고해상도를 위해 크기 증가 (화면에는 200px로 표시, 실제 캔버스는 400px)
      const size = 400;

      // QR 코드를 캔버스에 그리기
      await QRCode.toCanvas(canvas, url, {
        width: size,
        margin: 2,
        errorCorrectionLevel: logoSrc ? "H" : "M", // 로고가 있으면 높은 에러 정정
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      // 로고가 있으면 중앙에 그리기
      if (logoSrc) {
        try {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const logo = await loadImage(logoSrc);
            const logoSize = size * 0.22; // QR 크기의 22%
            const position = (size - logoSize) / 2;

            // 로고 배경 (흰색 원형)
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, logoSize / 2 + 6, 0, Math.PI * 2);
            ctx.fillStyle = "#FFFFFF";
            ctx.fill();

            // 로고 그리기
            ctx.drawImage(logo, position, position, logoSize, logoSize);
          }
        } catch {
          console.warn("로고 로드 실패, 로고 없이 생성");
        }
      }

      return canvas.toDataURL("image/png");
    },
    []
  );

  // URL 확정 후 QR 생성
  const generateQR = useCallback(async () => {
    if (!inputUrl.trim()) {
      setQrDataUrl("");
      setActiveUrl("");
      setError("");
      return;
    }

    // URL 유효성 검사
    try {
      new URL(inputUrl);
    } catch {
      setError("올바른 URL 형식이 아닙니다");
      setQrDataUrl("");
      return;
    }

    setActiveUrl(inputUrl);
    setError("");
  }, [inputUrl]);

  // activeUrl 또는 logoOption 변경 시 QR 코드 재생성
  useEffect(() => {
    if (!activeUrl) return;

    const regenerate = async () => {
      setIsGenerating(true);
      try {
        let logoSrc: string | null = null;

        if (logoOption === "linku") {
          logoSrc = LINKU_LOGO_URL;
        } else if (logoOption === "custom" && customLogoUrl) {
          logoSrc = customLogoUrl;
        }

        const dataUrl = await generateQRWithLogo(activeUrl, logoSrc);
        setQrDataUrl(dataUrl);
        setError("");
      } catch {
        setError("QR 코드 생성에 실패했습니다");
        setQrDataUrl("");
      } finally {
        setIsGenerating(false);
      }
    };

    regenerate();
  }, [activeUrl, logoOption, customLogoUrl, generateQRWithLogo]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      generateQR();
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;

    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = "linku_qr.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일만 허용
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드 가능합니다");
      return;
    }

    // FileReader로 Data URL 생성
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setCustomLogoUrl(dataUrl);
      setLogoOption("custom");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomLogo = () => {
    setCustomLogoUrl("");
    setLogoOption("linku");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4 pt-4 mt-4 border-t">
      <h2 className="text-base font-semibold">QR 코드 생성</h2>

      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            URL을 입력하면 QR 코드로 변환합니다.
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://example.com"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={generateQR}
            disabled={isGenerating}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>

        {/* 로고 옵션 */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">중앙 로고</Label>
          <div className="flex items-center gap-2">
            <Button
              variant={logoOption === "none" ? "default" : "outline"}
              size="sm"
              onClick={() => setLogoOption("none")}
              className="text-xs h-7"
            >
              없음
            </Button>
            <Button
              variant={logoOption === "linku" ? "default" : "outline"}
              size="sm"
              onClick={() => setLogoOption("linku")}
              className="text-xs h-7"
            >
              LinKU
            </Button>
            <Button
              variant={logoOption === "custom" ? "default" : "outline"}
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs h-7"
            >
              <Upload className="h-3 w-3 mr-1" />
              업로드
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* 커스텀 로고 미리보기 */}
          {logoOption === "custom" && customLogoUrl && (
            <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
              <img
                src={customLogoUrl}
                alt="Custom logo"
                className="h-8 w-8 object-contain rounded"
              />
              <span className="text-xs text-muted-foreground flex-1">
                커스텀 로고
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleRemoveCustomLogo}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {qrDataUrl && (
          <div className="flex flex-col items-center gap-3 py-4">
            <img
              src={qrDataUrl}
              alt="QR Code"
              className="border rounded-lg shadow-sm w-[200px] h-[200px]"
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
