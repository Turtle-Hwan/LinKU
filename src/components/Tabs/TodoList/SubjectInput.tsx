import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubjectLabel } from "@/types/subjectLabel";
import {
  getSubjectLabels,
  addSubjectLabel,
  incrementSubjectLabelUsage,
  DEFAULT_COLORS,
} from "@/utils/subjectLabel";
import { Check, Plus, X } from "lucide-react";

interface SubjectInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  eCampusSubjects?: string[]; // eCampus에서 가져온 과목 리스트
}

const SubjectInput = ({
  value,
  onChange,
  disabled = false,
  eCampusSubjects = [],
}: SubjectInputProps) => {
  const [labels, setLabels] = useState<SubjectLabel[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [newLabelColor, setNewLabelColor] = useState(DEFAULT_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 과목 라벨 로드
  useEffect(() => {
    loadLabels();
  }, []);

  const loadLabels = async () => {
    const loadedLabels = await getSubjectLabels();
    // 사용 횟수 기준 정렬
    setLabels(loadedLabels.sort((a, b) => b.usageCount - a.usageCount));
  };

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setShowColorPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 입력값과 일치하는 항목 필터링
  const filteredSuggestions = () => {
    const query = value.toLowerCase();
    
    // 라벨에서 필터링
    const labelSuggestions = labels
      .filter((label) => label.name.toLowerCase().includes(query))
      .map((label) => ({ name: label.name, color: label.color, isLabel: true }));

    // eCampus 과목에서 필터링 (이미 라벨로 등록되지 않은 것만)
    const eCampusSuggestions = eCampusSubjects
      .filter((subject) => 
        subject.toLowerCase().includes(query) &&
        !labels.some((label) => label.name === subject)
      )
      .map((subject) => ({ name: subject, color: undefined, isLabel: false }));

    return [...labelSuggestions, ...eCampusSuggestions];
  };

  const handleSelectSuggestion = async (name: string) => {
    onChange(name);
    setShowDropdown(false);
    setShowColorPicker(false);
    
    // 라벨 사용 횟수 증가
    await incrementSubjectLabelUsage(name);
    await loadLabels();
  };

  const handleCreateLabel = async () => {
    if (!value.trim()) return;

    try {
      await addSubjectLabel(value.trim(), newLabelColor);
      await loadLabels();
      setShowColorPicker(false);
      setShowDropdown(false);
      // 새로 만든 라벨 색상 기본값으로 리셋
      setNewLabelColor(DEFAULT_COLORS[0]);
    } catch (error) {
      console.error("Failed to create label:", error);
    }
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  const suggestions = filteredSuggestions();
  const hasExactMatch = labels.some((label) => label.name === value);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleInputFocus}
        placeholder="과목명 (선택사항)"
        disabled={disabled}
      />

      {showDropdown && !disabled && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {/* 제안 목록 */}
          {suggestions.length > 0 && (
            <div className="py-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion.name)}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2"
                >
                  {suggestion.color && (
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: suggestion.color }}
                    />
                  )}
                  <span className="flex-1">{suggestion.name}</span>
                  {suggestion.isLabel && (
                    <Check className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* 새 라벨 생성 옵션 */}
          {value.trim() && !hasExactMatch && (
            <>
              {suggestions.length > 0 && (
                <div className="border-t border-gray-200" />
              )}
              <div className="p-2">
                {!showColorPicker ? (
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(true)}
                    className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-sm text-gray-600"
                  >
                    <Plus className="w-4 h-4" />
                    <span>"{value}" 라벨로 추가</span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">색상 선택:</span>
                      <button
                        type="button"
                        onClick={() => setShowColorPicker(false)}
                        className="ml-auto text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-8 gap-1">
                      {DEFAULT_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewLabelColor(color)}
                          className={`w-6 h-6 rounded-full border-2 ${
                            newLabelColor === color
                              ? "border-gray-900 scale-110"
                              : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <Button
                      type="button"
                      onClick={handleCreateLabel}
                      size="sm"
                      className="w-full"
                    >
                      생성
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 빈 상태 */}
          {suggestions.length === 0 && !value.trim() && (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              {eCampusSubjects.length > 0
                ? "과목을 입력하거나 선택하세요"
                : "과목명을 입력하세요"}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubjectInput;
