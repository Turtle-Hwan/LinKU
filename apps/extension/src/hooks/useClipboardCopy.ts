import { useState, useCallback } from "react";
import { toast } from "sonner";

/**
 * 클립보드 복사 기능을 제공하는 커스텀 훅
 *
 * @returns copyToClipboard 함수와 isCopied 상태
 *
 * @example
 * ```tsx
 * const { copyToClipboard, isCopied } = useClipboardCopy();
 *
 * <button onClick={() => copyToClipboard("텍스트")}>
 *   {isCopied ? "복사됨!" : "복사"}
 * </button>
 * ```
 */
export const useClipboardCopy = () => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success("클립보드에 복사되었습니다!");

      //복사 상태 초기화
      setTimeout(() => {
        setIsCopied(false);
      }, 1000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "알 수 없는 오류";
      toast.error(`복사 실패: ${errorMessage}`);
      console.error("Failed to copy to clipboard:", error);
    }
  }, []);

  return { copyToClipboard, isCopied };
};
