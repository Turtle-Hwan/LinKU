/**
 * Editor Sidebar - Left sidebar with template info, icon upload, and staging area
 */

import { useState } from 'react';
import { useEditorContext } from '@/contexts/EditorContext';
import { GRID_CONFIG } from '@/utils/template';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { IconUploadButton } from './IconUploadButton';
import { StagingArea } from './StagingArea';
import { QuickAddDialog } from './QuickAddDialog';
import type { Icon } from '@/types/api';

export const EditorSidebar = () => {
  const { state, dispatch } = useEditorContext();
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const handleIconUploaded = (icon: Icon) => {
    // Add uploaded icon to user icons list
    dispatch({ type: 'ADD_USER_ICON', payload: icon });
  };

  const handleQuickAdd = ({ name, url, iconId }: { name: string; url: string; iconId: number }) => {
    if (!state.template) return;

    // Find the selected icon from both default and user icons
    const allIcons = [...(state.defaultIcons || []), ...(state.userIcons || [])];
    const selectedIcon = allIcons.find((icon) => icon.id === iconId);
    if (!selectedIcon) return;

    // Add new item to staging area (not directly to canvas)
    const newItem = {
      templateItemId: -(Date.now()), // Temporary negative ID
      name,
      siteUrl: url,
      position: { x: 0, y: 0 }, // Default position
      size: { width: 2, height: 1 }, // Default size
      icon: selectedIcon,
    };

    dispatch({ type: 'ADD_TO_STAGING', payload: newItem });
  };

  return (
    <aside className="w-64 border-r bg-background overflow-y-auto flex flex-col">
      {/* Template Info */}
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm mb-2">템플릿 정보</h3>
        {state.template && (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>이름: {state.template.name}</p>
            <p>캔버스: {state.template.items.length}개</p>
            <p>임시: {state.stagingItems?.length || 0}개</p>
            <p>크기: {GRID_CONFIG.COLS}열 × {state.template.height}행</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-b space-y-2">
        <Button
          onClick={() => setShowQuickAdd(true)}
          className="w-full"
          variant="default"
          size="sm"
        >
          <Zap className="h-4 w-4 mr-2" />
          빠른 링크 추가
        </Button>

        <IconUploadButton onIconUploaded={handleIconUploaded} />
      </div>

      {/* Staging Area */}
      <StagingArea />

      {/* Quick Add Dialog */}
      <QuickAddDialog
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onAdd={handleQuickAdd}
      />
    </aside>
  );
};
