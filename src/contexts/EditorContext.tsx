/**
 * Editor Context - State management for template editor
 * Uses useReducer pattern for complex state management
 */

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import type { Template, TemplateItem, Icon } from '@/types/api';
import { getTemplate } from '@/apis/templates';
import { getDefaultIcons } from '@/apis/icons';
import { convertLinkListToTemplateItems, calculateTemplateHeight } from '@/utils/template';

/**
 * Editor state interface
 */
export interface EditorState {
  template: Template | null;
  selectedItemId: number | null;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  mode: 'create' | 'edit';
  error: string | null;
  // New states for staging area and icons
  stagingItems: TemplateItem[];
  defaultIcons: Icon[];
  userIcons: Icon[];
}

/**
 * Editor actions
 */
export type EditorAction =
  | { type: 'LOAD_TEMPLATE'; payload: Template }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_TEMPLATE_NAME'; payload: string }
  | { type: 'UPDATE_TEMPLATE_HEIGHT'; payload: number }
  | { type: 'ADD_ITEM'; payload: TemplateItem }
  | { type: 'UPDATE_ITEM'; payload: { id: number; changes: Partial<TemplateItem> } }
  | { type: 'DELETE_ITEM'; payload: number }
  | { type: 'MOVE_ITEM'; payload: { id: number; position: { x: number; y: number } } }
  | { type: 'RESIZE_ITEM'; payload: { id: number; size: { width: number; height: number } } }
  | { type: 'SELECT_ITEM'; payload: number | null }
  | { type: 'START_SAVING' }
  | { type: 'SAVE_SUCCESS'; payload: Template }
  | { type: 'SAVE_FAILED'; payload: string }
  | { type: 'MARK_DIRTY' }
  | { type: 'MARK_CLEAN' }
  // New actions for staging area and icons
  | { type: 'ADD_TO_STAGING'; payload: TemplateItem }
  | { type: 'REMOVE_FROM_STAGING'; payload: number }
  | { type: 'MOVE_TO_CANVAS'; payload: number }
  | { type: 'MOVE_TO_STAGING'; payload: number }
  | { type: 'UPDATE_STAGING_ITEM'; payload: { id: number; changes: Partial<TemplateItem> } }
  | { type: 'LOAD_DEFAULT_ICONS'; payload: Icon[] }
  | { type: 'LOAD_USER_ICONS'; payload: Icon[] }
  | { type: 'ADD_USER_ICON'; payload: Icon };

/**
 * Initial state
 */
const initialState: EditorState = {
  template: null,
  selectedItemId: null,
  isDirty: false,
  isSaving: false,
  isLoading: false,
  mode: 'create',
  error: null,
  stagingItems: [],
  defaultIcons: [],
  userIcons: [],
};

/**
 * Editor reducer
 */
const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  switch (action.type) {
    case 'LOAD_TEMPLATE':
      return {
        ...state,
        template: action.payload,
        mode: 'edit',
        isLoading: false,
        isDirty: false,
      };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'UPDATE_TEMPLATE_NAME':
      if (!state.template) return state;
      return {
        ...state,
        template: { ...state.template, name: action.payload },
        isDirty: true,
      };

    case 'UPDATE_TEMPLATE_HEIGHT':
      if (!state.template) return state;
      return {
        ...state,
        template: { ...state.template, height: action.payload },
        isDirty: true,
      };

    case 'ADD_ITEM':
      if (!state.template) return state;
      return {
        ...state,
        template: {
          ...state.template,
          items: [...state.template.items, action.payload],
        },
        isDirty: true,
      };

    case 'UPDATE_ITEM':
      if (!state.template) return state;
      return {
        ...state,
        template: {
          ...state.template,
          items: state.template.items.map((item) =>
            item.templateItemId === action.payload.id
              ? { ...item, ...action.payload.changes }
              : item
          ),
        },
        isDirty: true,
      };

    case 'DELETE_ITEM':
      if (!state.template) return state;
      return {
        ...state,
        template: {
          ...state.template,
          items: state.template.items.filter(
            (item) => item.templateItemId !== action.payload
          ),
        },
        selectedItemId:
          state.selectedItemId === action.payload ? null : state.selectedItemId,
        isDirty: true,
      };

    case 'MOVE_ITEM':
      if (!state.template) return state;
      return {
        ...state,
        template: {
          ...state.template,
          items: state.template.items.map((item) =>
            item.templateItemId === action.payload.id
              ? { ...item, position: action.payload.position }
              : item
          ),
        },
        isDirty: true,
      };

    case 'RESIZE_ITEM':
      if (!state.template) return state;
      return {
        ...state,
        template: {
          ...state.template,
          items: state.template.items.map((item) =>
            item.templateItemId === action.payload.id
              ? { ...item, size: action.payload.size }
              : item
          ),
        },
        isDirty: true,
      };

    case 'SELECT_ITEM':
      return { ...state, selectedItemId: action.payload };

    case 'START_SAVING':
      return { ...state, isSaving: true, error: null };

    case 'SAVE_SUCCESS':
      return {
        ...state,
        template: action.payload,
        isSaving: false,
        isDirty: false,
        mode: 'edit',
      };

    case 'SAVE_FAILED':
      return { ...state, isSaving: false, error: action.payload };

    case 'MARK_DIRTY':
      return { ...state, isDirty: true };

    case 'MARK_CLEAN':
      return { ...state, isDirty: false };

    // Staging area actions
    case 'ADD_TO_STAGING':
      return {
        ...state,
        stagingItems: [...state.stagingItems, action.payload],
      };

    case 'REMOVE_FROM_STAGING':
      return {
        ...state,
        stagingItems: state.stagingItems.filter(
          (item) => item.templateItemId !== action.payload
        ),
      };

    case 'MOVE_TO_CANVAS':
      if (!state.template) return state;
      const itemToMove = state.stagingItems.find(
        (item) => item.templateItemId === action.payload
      );
      if (!itemToMove) return state;

      // Find first available position for the item
      // Start from top-left (0,0) and scan for empty spot
      let newPosition = { x: 0, y: 0 };
      let foundPosition = false;

      for (let y = 0; y <= 6 - itemToMove.size.height && !foundPosition; y++) {
        for (let x = 0; x <= 6 - itemToMove.size.width && !foundPosition; x++) {
          const testPos = { x, y };
          // Check if this position overlaps with any existing item
          const hasOverlap = state.template.items.some((existing) => {
            const xOverlap =
              testPos.x < existing.position.x + existing.size.width &&
              testPos.x + itemToMove.size.width > existing.position.x;
            const yOverlap =
              testPos.y < existing.position.y + existing.size.height &&
              testPos.y + itemToMove.size.height > existing.position.y;
            return xOverlap && yOverlap;
          });

          if (!hasOverlap) {
            newPosition = testPos;
            foundPosition = true;
          }
        }
      }

      return {
        ...state,
        template: {
          ...state.template,
          items: [...state.template.items, { ...itemToMove, position: newPosition }],
        },
        stagingItems: state.stagingItems.filter(
          (item) => item.templateItemId !== action.payload
        ),
        isDirty: true,
      };

    case 'MOVE_TO_STAGING':
      if (!state.template) return state;
      const itemToStage = state.template.items.find(
        (item) => item.templateItemId === action.payload
      );
      if (!itemToStage) return state;
      return {
        ...state,
        template: {
          ...state.template,
          items: state.template.items.filter(
            (item) => item.templateItemId !== action.payload
          ),
        },
        stagingItems: [...state.stagingItems, itemToStage],
        selectedItemId: state.selectedItemId === action.payload ? null : state.selectedItemId,
        isDirty: true,
      };

    case 'UPDATE_STAGING_ITEM':
      return {
        ...state,
        stagingItems: state.stagingItems.map((item) =>
          item.templateItemId === action.payload.id
            ? { ...item, ...action.payload.changes }
            : item
        ),
      };

    // Icon management actions
    case 'LOAD_DEFAULT_ICONS':
      return {
        ...state,
        defaultIcons: action.payload,
      };

    case 'LOAD_USER_ICONS':
      return {
        ...state,
        userIcons: action.payload,
      };

    case 'ADD_USER_ICON':
      return {
        ...state,
        userIcons: [...state.userIcons, action.payload],
      };

    default:
      return state;
  }
};

/**
 * Editor context value
 */
interface EditorContextValue {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

const EditorContext = createContext<EditorContextValue | undefined>(undefined);

/**
 * useEditorContext hook
 */
export const useEditorContext = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditorContext must be used within EditorProvider');
  }
  return context;
};

/**
 * EditorProvider props
 */
interface EditorProviderProps {
  children: ReactNode;
  templateId?: number;
}

/**
 * EditorProvider component
 */
export const EditorProvider = ({ children, templateId }: EditorProviderProps) => {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  // Template loading effect
  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId);
    } else {
      initializeNewTemplate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  /**
   * Load existing template
   */
  const loadTemplate = async (id: number) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await getTemplate(id);
      if (result.success && result.data) {
        dispatch({ type: 'LOAD_TEMPLATE', payload: result.data });
      } else {
        dispatch({
          type: 'SET_ERROR',
          payload: result.error?.message || '템플릿을 불러올 수 없습니다.',
        });
      }
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: '템플릿 로딩 중 오류가 발생했습니다.',
      });
      console.error('Failed to load template:', error);
    }
  };

  /**
   * Initialize new template with default LinkList items
   */
  const initializeNewTemplate = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // Load default icons from backend
      const iconsResult = await getDefaultIcons();

      console.log('Icons API Response:', iconsResult);

      // Ensure defaultIcons is an array
      let defaultIcons: Icon[] = [];
      if (iconsResult.success && iconsResult.data) {
        // Handle both array and object responses
        if (Array.isArray(iconsResult.data)) {
          defaultIcons = iconsResult.data;
        } else if (typeof iconsResult.data === 'object') {
          // Check if data has an 'items' property (paginated response)
          defaultIcons = Array.isArray((iconsResult.data as any).items)
            ? (iconsResult.data as any).items
            : [];
        }
      }

      console.log('Processed defaultIcons:', defaultIcons);

      if (!Array.isArray(defaultIcons) || defaultIcons.length === 0) {
        console.warn('No default icons available, creating empty template');
        defaultIcons = [];
      }

      // Convert LinkList to TemplateItems
      const templateItems = convertLinkListToTemplateItems(defaultIcons);
      const templateHeight = calculateTemplateHeight();

      const newTemplate: Template = {
        templateId: 0,
        name: '새 템플릿',
        height: templateHeight,
        cloned: false,
        items: templateItems,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      dispatch({ type: 'LOAD_TEMPLATE', payload: newTemplate });
      dispatch({ type: 'LOAD_DEFAULT_ICONS', payload: defaultIcons });
    } catch (error) {
      console.error('Failed to initialize template:', error);
      // Fallback: create empty template with 6 rows
      const emptyTemplate: Template = {
        templateId: 0,
        name: '새 템플릿',
        height: 6, // 6 rows (grid units)
        cloned: false,
        items: [],
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: 'LOAD_TEMPLATE', payload: emptyTemplate });
    }
  };

  return (
    <EditorContext.Provider value={{ state, dispatch }}>
      {children}
    </EditorContext.Provider>
  );
};
