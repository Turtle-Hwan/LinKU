# Subject Label Feature Documentation

## 개요
'Add Todo' 기능에서 '과목명'을 보다 편리하게 입력할 수 있도록 개선된 기능입니다.

## 주요 기능

### 1. 과목명 자동완성 및 제안
- **eCampus 연동**: 사용자가 eCampus에 로그인하면 수강 중인 과목 목록을 자동으로 가져와 제안합니다
- **드롭다운 메뉴**: 과목명 입력 필드를 클릭하면 등록된 라벨과 eCampus 과목이 드롭다운으로 표시됩니다
- **실시간 필터링**: 입력하는 동안 일치하는 과목들만 필터링되어 표시됩니다

### 2. 과목 라벨 시스템
- **라벨 생성**: 새로운 과목명을 입력하면 라벨로 추가할 수 있는 옵션이 표시됩니다
- **색상 지정**: 8가지 기본 색상 팔레트에서 과목별 색상을 선택할 수 있습니다
  - 건대 녹색 (#007a30)
  - 빨강 (#ef4444)
  - 주황 (#f59e0b)
  - 초록 (#10b981)
  - 파랑 (#3b82f6)
  - 보라 (#8b5cf6)
  - 분홍 (#ec4899)
  - 인디고 (#6366f1)
- **사용 빈도 추적**: 자주 사용하는 과목이 드롭다운 상단에 표시됩니다
- **색상 표시**: Todo 항목에서 과목명 옆에 색상 점(dot)이 표시되어 시각적으로 구분됩니다

## 사용 방법

### 과목 라벨 생성하기
1. 'Add Todo' 버튼 클릭
2. '과목명' 필드 클릭하여 드롭다운 열기
3. 새로운 과목명 입력 (예: "웹프로그래밍")
4. 드롭다운 하단에 표시되는 "'{과목명}' 라벨로 추가" 클릭
5. 원하는 색상 선택
6. '생성' 버튼 클릭

### 기존 과목 라벨 선택하기
1. 'Add Todo' 버튼 클릭
2. '과목명' 필드 클릭
3. 드롭다운에서 원하는 과목 선택 (색상 점이 표시된 항목이 등록된 라벨)

### eCampus 과목 선택하기
1. eCampus에 로그인한 상태에서
2. 'Add Todo' 버튼 클릭
3. '과목명' 필드 클릭
4. 드롭다운에서 수강 중인 과목 선택

## 기술 구현

### 파일 구조
```
src/
├── types/
│   └── subjectLabel.ts          # SubjectLabel 타입 정의
├── utils/
│   └── subjectLabel.ts          # 라벨 관리 유틸리티 함수
└── components/
    └── Tabs/
        └── TodoList/
            ├── SubjectInput.tsx      # 과목명 입력 컴포넌트
            ├── TodoAddDialog.tsx     # 수정: SubjectInput 통합
            ├── TodoAddButton.tsx     # 수정: eCampus 과목 전달
            ├── TodoList.tsx          # 수정: 고유 과목 추출
            └── TodoItem.tsx          # 수정: 색상 표시
```

### 데이터 저장
- **저장소**: Chrome Storage Local API
- **키**: `subjectLabels`
- **데이터 구조**:
```typescript
interface SubjectLabel {
  id: string;           // 고유 식별자
  name: string;         // 과목명
  color: string;        // 색상 (hex)
  createdAt: number;    // 생성 시간
  usageCount: number;   // 사용 횟수
}
```

### 주요 함수

#### subjectLabel.ts
- `getSubjectLabels()`: 모든 라벨 가져오기
- `addSubjectLabel(name, color)`: 새 라벨 추가
- `updateSubjectLabel(id, updates)`: 라벨 수정
- `deleteSubjectLabel(id)`: 라벨 삭제
- `incrementSubjectLabelUsage(name)`: 사용 횟수 증가
- `getSubjectLabelByName(name)`: 이름으로 라벨 찾기

## 사용자 경험 개선

### Before
- 과목명을 매번 직접 타이핑해야 함
- 과목 구분이 텍스트로만 가능

### After
- eCampus 과목 자동 제안
- 드롭다운에서 빠른 선택
- 색상으로 과목 시각적 구분
- 자주 사용하는 과목 우선 표시

## 향후 개선 가능 사항
1. 라벨 관리 페이지 추가 (편집/삭제 기능)
2. 커스텀 색상 입력 지원
3. 과목별 통계 기능 (완료율, 평균 소요 시간 등)
4. 과목 라벨 내보내기/가져오기 기능
