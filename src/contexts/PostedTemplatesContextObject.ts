import { createContext } from 'react';
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
