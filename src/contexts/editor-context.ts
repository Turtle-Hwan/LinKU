import { createContext, useContext } from 'react';
import type { Dispatch } from 'react';
import type { EditorAction, EditorState } from './EditorContext';

export interface EditorContextValue {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
}

export const EditorContext = createContext<EditorContextValue | undefined>(
  undefined,
);

export function useEditorContext() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditorContext must be used within EditorProvider');
  }
  return context;
}
