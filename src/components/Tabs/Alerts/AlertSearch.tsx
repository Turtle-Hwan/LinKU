import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface AlertSearchProps {
  value: string;
  onValueChange: (value: string) => void;
}

const AlertSearch = ({ value, onValueChange }: AlertSearchProps) => {
  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onValueChange("");
          }
        }}
        aria-label="공지사항 검색"
        placeholder="공지 제목·내용 검색"
        autoComplete="off"
        className="pl-9 pr-9 text-sm [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onValueChange("")}
          aria-label="검색어 지우기"
          className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default AlertSearch;
