import { createContext, useContext } from 'react';
import type { Dispatch } from 'react';
import type {
  PostedTemplatesAction,
  PostedTemplatesState,
} from './PostedTemplatesContext';

export interface PostedTemplatesContextValue {
  state: PostedTemplatesState;
  dispatch: Dispatch<PostedTemplatesAction>;
}

export const PostedTemplatesContext = createContext<
  PostedTemplatesContextValue | undefined
>(undefined);

export function usePostedTemplatesContext() {
  const context = useContext(PostedTemplatesContext);
  if (!context) {
    throw new Error(
      'usePostedTemplatesContext must be used within PostedTemplatesProvider',
    );
  }
  return context;
}
