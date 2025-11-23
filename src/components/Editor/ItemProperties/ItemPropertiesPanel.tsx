/**
 * Item Properties Panel - Right panel for editing selected item
 * Simplified version for initial implementation
 */

import { useEditorContext } from '@/contexts/EditorContext';

export const ItemPropertiesPanel = () => {
  const { state } = useEditorContext();

  if (!state.selectedItemId) {
    return null;
  }

  const selectedItem = state.template?.items.find(
    (item) => item.templateItemId === state.selectedItemId
  );

  if (!selectedItem) {
    return null;
  }

  return (
    <aside className="w-80 border-l bg-background p-4 overflow-y-auto">
      <div className="space-y-4">
        <h3 className="font-semibold">Item Properties</h3>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Name:</span>{' '}
            {selectedItem.name}
          </div>
          <div>
            <span className="text-muted-foreground">URL:</span>{' '}
            <span className="truncate block">{selectedItem.siteUrl}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Position:</span>{' '}
            {selectedItem.position.x}, {selectedItem.position.y}
          </div>
          <div>
            <span className="text-muted-foreground">Size:</span>{' '}
            {selectedItem.size.width} × {selectedItem.size.height}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Full property editing (IconSelector, PositionEditor, SizeEditor, UrlEditor) will be added in next phase
        </p>
      </div>
    </aside>
  );
};
