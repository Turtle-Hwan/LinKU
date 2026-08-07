import type { ReactNode } from "react";
import { getHighlightRanges } from "./alertSearchUtils";

interface AlertSearchHighlightProps {
  text: string;
  query?: string;
}

const AlertSearchHighlight = ({
  text,
  query = "",
}: AlertSearchHighlightProps) => {
  const ranges = getHighlightRanges(text, query);

  if (ranges.length === 0) {
    return <>{text}</>;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;

  ranges.forEach(({ start, end }) => {
    if (start > cursor) {
      parts.push(text.slice(cursor, start));
    }

    parts.push(
      <mark
        key={`${start}-${end}`}
        className="rounded-sm bg-yellow-200 text-inherit decoration-clone dark:bg-yellow-300/70"
      >
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  });

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <>{parts}</>;
};

export default AlertSearchHighlight;
