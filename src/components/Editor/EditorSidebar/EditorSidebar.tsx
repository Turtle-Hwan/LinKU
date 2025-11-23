/**
 * Editor Sidebar - Left sidebar with template info and item palette
 */

import { useState, useEffect } from 'react';
import { useEditorContext } from '@/contexts/EditorContext';
import { getDefaultIcons } from '@/apis/icons';
import type { Icon } from '@/types/api';
import { Plus, Zap } from 'lucide-react';
import { GRID_CONFIG } from '@/utils/template';
import { Button } from '@/components/ui/button';
import { QuickAddDialog } from '../QuickAddDialog';

export const EditorSidebar = () => {
  const { state, dispatch } = useEditorContext();
  const [defaultIcons, setDefaultIcons] = useState<Icon[]>([]);
  const [isLoadingIcons, setIsLoadingIcons] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Load default icons
  useEffect(() => {
    const loadIcons = async () => {
      setIsLoadingIcons(true);
      try {
        const result = await getDefaultIcons();
        console.log('EditorSidebar - Icons API Response:', result);

        if (result.success && result.data) {
          // Ensure data is an array
          let icons: Icon[] = [];
          if (Array.isArray(result.data)) {
            icons = result.data;
          } else if (typeof result.data === 'object' && Array.isArray((result.data as any).items)) {
            icons = (result.data as any).items;
          }

          console.log('EditorSidebar - Processed icons:', icons);
          setDefaultIcons(icons);
        }
      } catch (error) {
        console.error('EditorSidebar - Failed to load icons:', error);
      } finally {
        setIsLoadingIcons(false);
      }
    };

    loadIcons();
  }, []);

  const handleAddItem = (icon: Icon) => {
    if (!state.template) return;

    // Add new item at grid position (0, 0) with standard size
    const newItem = {
      templateItemId: -(Date.now()), // Temporary negative ID
      name: icon.iconName,
      siteUrl: '',
      position: { x: 0, y: 0 }, // Grid coordinates (top-left)
      size: { width: 2, height: 1 }, // Grid size (2 columns, 1 row)
      icon: icon,
    };

    dispatch({ type: 'ADD_ITEM', payload: newItem });
  };

  const handleQuickAdd = ({ name, url, iconId }: { name: string; url: string; iconId: number }) => {
    if (!state.template) return;

    // Find the selected icon
    const selectedIcon = defaultIcons.find((icon) => icon.iconId === iconId);
    if (!selectedIcon) return;

    // Add new item with complete information
    const newItem = {
      templateItemId: -(Date.now()), // Temporary negative ID
      name,
      siteUrl: url,
      position: { x: 0, y: 0 }, // Grid coordinates (top-left)
      size: { width: 2, height: 1 }, // Grid size (2 columns, 1 row)
      icon: selectedIcon,
    };

    dispatch({ type: 'ADD_ITEM', payload: newItem });
  };

  return (
    <aside className="w-64 border-r bg-background overflow-y-auto flex flex-col">
      {/* Template Info */}
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm mb-2">템플릿 정보</h3>
        {state.template && (
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>이름: {state.template.name}</p>
            <p>아이템: {state.template.items.length}개</p>
            <p>크기: {GRID_CONFIG.COLS}열 × {state.template.height}행</p>
          </div>
        )}
      </div>

      {/* Quick Add Button */}
      <div className="p-4 border-b">
        <Button
          onClick={() => setShowQuickAdd(true)}
          className="w-full"
          variant="default"
          size="sm"
        >
          <Zap className="h-4 w-4 mr-2" />
          빠른 링크 추가
        </Button>
      </div>

      {/* Item Palette */}
      <div className="flex-1 p-4">
        <h3 className="font-semibold text-sm mb-3">아이콘 추가</h3>

        {isLoadingIcons ? (
          <div className="text-xs text-muted-foreground">로딩 중...</div>
        ) : defaultIcons.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            사용 가능한 아이콘이 없습니다
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {defaultIcons.map((icon) => (
              <button
                key={icon.iconId}
                onClick={() => handleAddItem(icon)}
                className="p-2 border rounded-lg hover:bg-accent hover:border-primary transition-colors flex flex-col items-center gap-1 group"
                title={`${icon.iconName} 추가`}
              >
                <div className="w-10 h-10 flex items-center justify-center">
                  <img
                    src={icon.iconUrl}
                    alt={icon.iconName}
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <span className="text-[10px] text-center truncate w-full text-muted-foreground group-hover:text-foreground">
                  {icon.iconName}
                </span>
                <Plus className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="p-4 border-t bg-muted/30">
        <p className="text-[10px] text-muted-foreground">
          💡 아이콘을 클릭하여 캔버스에 추가하고, 드래그하여 위치를 조정하세요
        </p>
      </div>

      {/* Quick Add Dialog */}
      <QuickAddDialog
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onAdd={handleQuickAdd}
      />
    </aside>
  );
};
