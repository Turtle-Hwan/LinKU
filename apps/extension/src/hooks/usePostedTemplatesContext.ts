import { useContext } from 'react';
import { PostedTemplatesContext } from '@/contexts/PostedTemplatesContextObject';

export function usePostedTemplatesContext() {
  const context = useContext(PostedTemplatesContext);
  if (!context) {
    throw new Error(
      'usePostedTemplatesContext must be used within PostedTemplatesProvider',
    );
  }
  return context;
}
