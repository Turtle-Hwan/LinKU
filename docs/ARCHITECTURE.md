# Subject Label Feature - Architecture

## Component Hierarchy

```
TodoList
  ├─ TodoAddButton
  │   └─ TodoAddDialog
  │       └─ SubjectInput ← NEW COMPONENT
  │
  └─ TodoItem (multiple)
      └─ displays subject with color dot
```

## Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                         TodoList                              │
│                                                               │
│  1. Fetches eCampus todos                                    │
│  2. Extracts unique subjects → eCampusSubjects[]             │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    TodoAddButton                        │  │
│  │  Props: { eCampusSubjects }                            │  │
│  │                                                         │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │              TodoAddDialog                        │  │  │
│  │  │  Props: { eCampusSubjects }                      │  │  │
│  │  │                                                   │  │  │
│  │  │  ┌────────────────────────────────────────────┐  │  │  │
│  │  │  │          SubjectInput                      │  │  │  │
│  │  │  │  Props: { eCampusSubjects }               │  │  │  │
│  │  │  │                                            │  │  │  │
│  │  │  │  On Mount:                                 │  │  │  │
│  │  │  │  - Load saved labels from storage         │  │  │  │
│  │  │  │  - Sort by usage count                    │  │  │  │
│  │  │  │                                            │  │  │  │
│  │  │  │  On Input:                                 │  │  │  │
│  │  │  │  - Filter labels + eCampus subjects       │  │  │  │
│  │  │  │  - Show dropdown with suggestions         │  │  │  │
│  │  │  │                                            │  │  │  │
│  │  │  │  On Select:                                │  │  │  │
│  │  │  │  - Increment usage count                  │  │  │  │
│  │  │  │  - Fill input field                       │  │  │  │
│  │  │  │                                            │  │  │  │
│  │  │  │  On Create Label:                          │  │  │  │
│  │  │  │  - Save to Chrome Storage                 │  │  │  │
│  │  │  │  - Reload labels list                     │  │  │  │
│  │  │  └────────────────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                     TodoItem                            │  │
│  │  Props: { todo }                                       │  │
│  │                                                         │  │
│  │  On Mount:                                              │  │
│  │  - If todo.subject exists                              │  │
│  │    → Load matching label from storage                  │  │
│  │    → Display color dot if label found                  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Storage Layer

```
┌─────────────────────────────────────────────────────────────┐
│              Chrome Storage Local API                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Key: "subjectLabels"                                       │
│  Value: SubjectLabel[]                                      │
│                                                              │
│  [                                                           │
│    {                                                         │
│      id: "label-1696834567890-abc123",                      │
│      name: "웹프로그래밍",                                    │
│      color: "#007a30",                                       │
│      createdAt: 1696834567890,                              │
│      usageCount: 5                                          │
│    },                                                        │
│    ...                                                       │
│  ]                                                           │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│              Utility Functions (subjectLabel.ts)            │
├─────────────────────────────────────────────────────────────┤
│  - getSubjectLabels()        → Read all labels             │
│  - addSubjectLabel()         → Create new label            │
│  - updateSubjectLabel()      → Update existing label       │
│  - deleteSubjectLabel()      → Remove label                │
│  - incrementSubjectLabelUsage() → Track usage             │
│  - getSubjectLabelByName()   → Find by name                │
└─────────────────────────────────────────────────────────────┘
```

## State Management

### SubjectInput Component State

```typescript
const [labels, setLabels] = useState<SubjectLabel[]>([])
  ↓
  Loaded from Chrome Storage on mount
  Sorted by usageCount (descending)
  
const [showDropdown, setShowDropdown] = useState(false)
  ↓
  Opens on input focus
  Closes on outside click or selection
  
const [showColorPicker, setShowColorPicker] = useState(false)
  ↓
  Opens when clicking "라벨로 추가"
  Closes on color selection or cancel
  
const [newLabelColor, setNewLabelColor] = useState(DEFAULT_COLORS[0])
  ↓
  Selected color for new label
  Resets to default after creation
```

### TodoItem Component State

```typescript
const [subjectLabel, setSubjectLabel] = useState<SubjectLabel | null>(null)
  ↓
  Loaded on mount if todo.subject exists
  Used to display color dot
```

## Event Flow

### Create Label Flow

```
User types "웹프로그래밍"
  ↓
Dropdown shows "'웹프로그래밍' 라벨로 추가"
  ↓
User clicks on it
  ↓
setShowColorPicker(true)
  ↓
Color picker appears with 8 colors
  ↓
User selects green (#007a30)
  ↓
setNewLabelColor("#007a30")
  ↓
User clicks "생성"
  ↓
addSubjectLabel("웹프로그래밍", "#007a30")
  ↓
Chrome Storage: save label
  ↓
loadLabels() - refresh state
  ↓
setShowColorPicker(false)
  ↓
setShowDropdown(false)
  ↓
Input keeps "웹프로그래밍" value
```

### Select Label Flow

```
User clicks input field
  ↓
setShowDropdown(true)
  ↓
Dropdown shows:
  - Saved labels (with colors)
  - eCampus subjects (no colors)
  ↓
User types "웹" to filter
  ↓
filteredSuggestions() runs
  ↓
Only matching items shown
  ↓
User clicks "웹프로그래밍"
  ↓
handleSelectSuggestion("웹프로그래밍")
  ↓
onChange("웹프로그래밍")
  ↓
incrementSubjectLabelUsage("웹프로그래밍")
  ↓
Chrome Storage: update usageCount
  ↓
loadLabels() - refresh with new counts
  ↓
setShowDropdown(false)
```

## Integration Points

### With eCampus API

```
eCampusTodoListAPI()
  ↓
Returns: { todoList: ECampusTodoItem[] }
  ↓
Each item has: { subject: "웹프로그래밍", ... }
  ↓
TodoList extracts unique subjects
  ↓
const eCampusSubjects = useMemo(() => 
  Array.from(new Set(
    ecampusTodos.map(todo => todo.subject).filter(Boolean)
  ))
, [ecampusTodos])
  ↓
Passed down to SubjectInput as suggestions
```

### With Custom Todo Storage

```
addCustomTodo(title, dueDate, dueTime, subject)
  ↓
subject is optional string
  ↓
Stored in Chrome Storage under "customTodos"
  ↓
When rendered in TodoItem:
  - Load matching SubjectLabel
  - Display with color dot if label exists
```

## Type Safety

```typescript
// Type Definitions
interface SubjectLabel {
  id: string
  name: string
  color: string
  createdAt: number
  usageCount: number
}

// Component Props
interface SubjectInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  eCampusSubjects?: string[]
}

// Utility Functions
addSubjectLabel(name: string, color: string): Promise<SubjectLabel>
getSubjectLabelByName(name: string): Promise<SubjectLabel | undefined>

// All interactions are type-checked at compile time
```

## Performance Optimization

1. **useMemo** for eCampus subject extraction (TodoList)
2. **useCallback** for event handlers (click outside)
3. **Conditional rendering** - dropdown only when open
4. **Efficient filtering** - simple string includes
5. **Minimal re-renders** - state updates only when needed
6. **Async loading** - labels loaded once on mount
7. **Cleanup** - event listeners properly removed

## Error Handling

```typescript
try {
  await addSubjectLabel(name, color)
  // Success: refresh labels
} catch (error) {
  console.error("Failed to create label:", error)
  // Label creation failed but doesn't break UI
}
```

All storage operations are wrapped in try-catch blocks with fallback to empty arrays/undefined.

## Accessibility

- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ ARIA labels on buttons
- ✅ Semantic HTML (button, input)
- ✅ Focus management (auto-focus on input)
- ✅ Color contrast (WCAG AA compliant)

## Browser Compatibility

- ✅ Chrome 90+ (target platform)
- ✅ Uses standard APIs:
  - Chrome Storage API
  - DOM events
  - Fetch API (for eCampus)
- ⚠️ Chrome Extension specific (not web-compatible)
