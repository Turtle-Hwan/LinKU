/**
 * Posted Templates Context - State management for posted templates
 * Uses useReducer pattern for state management (consistent with EditorContext)
 */

import { createContext, useContext, useReducer, ReactNode } from 'react';
import type { PostedTemplateSummary } from '@/types/api';

/**
 * Posted templates state interface
 */
export interface PostedTemplatesState {
  postedTemplates: PostedTemplateSummary[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Posted templates actions
 */
export type PostedTemplatesAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_TEMPLATES'; payload: PostedTemplateSummary[] }
  | { type: 'ADD_TEMPLATE'; payload: PostedTemplateSummary }
  | { type: 'REMOVE_TEMPLATE'; payload: number }
  | { type: 'UPDATE_TEMPLATE'; payload: Partial<PostedTemplateSummary> & { postedTemplateId: number } }
  | { type: 'SET_ERROR'; payload: string | null };

/**
 * Initial state
 */
const initialState: PostedTemplatesState = {
  postedTemplates: [],
  isLoading: false,
  error: null,
};

/**
 * Posted templates reducer
 */
const postedTemplatesReducer = (
  state: PostedTemplatesState,
  action: PostedTemplatesAction
): PostedTemplatesState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_TEMPLATES':
      return { ...state, postedTemplates: action.payload, isLoading: false, error: null };

    case 'ADD_TEMPLATE':
      return {
        ...state,
        postedTemplates: [action.payload, ...state.postedTemplates],
      };

    case 'REMOVE_TEMPLATE':
      return {
        ...state,
        postedTemplates: state.postedTemplates.filter(
          (t) => t.postedTemplateId !== action.payload
        ),
      };

    case 'UPDATE_TEMPLATE':
      return {
        ...state,
        postedTemplates: state.postedTemplates.map((t) =>
          t.postedTemplateId === action.payload.postedTemplateId
            ? { ...t, ...action.payload }
            : t
        ),
      };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    default:
      return state;
  }
};

/**
 * Posted templates context value
 */
interface PostedTemplatesContextValue {
  state: PostedTemplatesState;
  dispatch: React.Dispatch<PostedTemplatesAction>;
}

const PostedTemplatesContext = createContext<PostedTemplatesContextValue | undefined>(undefined);

/**
 * usePostedTemplatesContext hook
 */
export const usePostedTemplatesContext = () => {
  const context = useContext(PostedTemplatesContext);
  if (!context) {
    throw new Error('usePostedTemplatesContext must be used within PostedTemplatesProvider');
  }
  return context;
};

/**
 * PostedTemplatesProvider props
 */
interface PostedTemplatesProviderProps {
  children: ReactNode;
}

/**
 * PostedTemplatesProvider component
 */
export const PostedTemplatesProvider = ({ children }: PostedTemplatesProviderProps) => {
  const [state, dispatch] = useReducer(postedTemplatesReducer, initialState);

  return (
    <PostedTemplatesContext.Provider value={{ state, dispatch }}>
      {children}
    </PostedTemplatesContext.Provider>
  );
};
