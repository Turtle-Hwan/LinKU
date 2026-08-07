import { useContext } from 'react';
import { EditorContext } from '@/contexts/EditorContextObject';

export function useEditorContext() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditorContext must be used within EditorProvider');
  }
  return context;
}
