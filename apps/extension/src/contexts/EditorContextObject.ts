import { createContext } from 'react';
import type { Dispatch } from 'react';
import type { EditorAction, EditorState } from './EditorContext';

export interface EditorContextValue {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
}

export const EditorContext = createContext<EditorContextValue | undefined>(
  undefined,
);
