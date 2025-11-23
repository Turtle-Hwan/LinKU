/**
 * Item Properties Panel - Right sidebar for editing selected item properties
 * Allows editing name, URL, icon, size, and position
 */

import { useState, useEffect } from 'react';
import { useEditorContext } from '@/contexts/EditorContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Save, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { GRID_CONFIG } from '@/utils/template';

export const ItemPropertiesPanel = () => {
  const { state, dispatch } = useEditorContext();

  // Find selected item (search both canvas and staging items)
  const selectedCanvasItem = state.template?.items.find(
    (item) => item.templateItemId === state.selectedItemId
  );
  const selectedStagingItem = state.stagingItems.find(
    (item) => item.templateItemId === state.selectedItemId
  );
  const selectedItem = selectedCanvasItem || selectedStagingItem;
  const isFromStaging = !!selectedStagingItem;

  // Local state for form fields
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedIconId, setSelectedIconId] = useState<number | null>(null);
  const [width, setWidth] = useState(2);
  const [height, setHeight] = useState(1);
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);

  // Update form when selected item changes
  useEffect(() => {
    if (selectedItem) {
      setName(selectedItem.name);
      setUrl(selectedItem.siteUrl);
      setSelectedIconId(selectedItem.icon.id);
      setWidth(selectedItem.size.width);
      setHeight(selectedItem.size.height);
      setPosX(selectedItem.position.x);
      setPosY(selectedItem.position.y);
    }
  }, [selectedItem]);

  // No item selected
  if (!selectedItem) {
    return (
      <aside className="w-72 border-l bg-background p-4">
        <div className="flex items-center justify-center h-full text-center">
          <p className="text-sm text-muted-foreground">
            아이템을 선택하면<br />속성을 편집할 수 있습니다
          </p>
        </div>
      </aside>
    );
  }

  const handleSave = () => {
    if (!selectedItem) return;

    if (!name.trim()) {
      toast.error('링크 이름을 입력해주세요.');
      return;
    }

    if (name.trim().length > 15) {
      toast.error('링크 이름은 15자 이하로 입력해주세요.');
      return;
    }

    if (!url.trim()) {
      toast.error('링크 URL을 입력해주세요.');
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      toast.error('올바른 URL을 입력해주세요.');
      return;
    }

    if (!selectedIconId) {
      toast.error('아이콘을 선택해주세요.');
      return;
    }

    // Find selected icon
    const allIcons = [...state.defaultIcons, ...state.userIcons];
    const icon = allIcons.find((i) => i.id === selectedIconId);
    if (!icon) {
      toast.error('선택한 아이콘을 찾을 수 없습니다.');
      return;
    }

    // Validate size bounds
    const clampedWidth = Math.max(1, Math.min(GRID_CONFIG.COLS, width));
    const clampedHeight = Math.max(1, Math.min(GRID_CONFIG.ROWS, height));

    // Validate position bounds
    const clampedPosX = Math.max(0, Math.min(GRID_CONFIG.COLS - clampedWidth, posX));
    const clampedPosY = Math.max(0, Math.min(GRID_CONFIG.ROWS - clampedHeight, posY));

    // Update item (use different action based on location)
    dispatch({
      type: isFromStaging ? 'UPDATE_STAGING_ITEM' : 'UPDATE_ITEM',
      payload: {
        id: selectedItem.templateItemId,
        changes: {
          name: name.trim(),
          siteUrl: url.trim(),
          icon,
          size: { width: clampedWidth, height: clampedHeight },
          position: { x: clampedPosX, y: clampedPosY },
        },
      },
    });

    toast.success('변경사항이 저장되었습니다.');
  };

  const handleDelete = () => {
    if (!selectedItem) return;

    if (isFromStaging) {
      // Permanently delete from staging
      dispatch({ type: 'REMOVE_FROM_STAGING', payload: selectedItem.templateItemId });
      toast.info('아이템이 영구 삭제되었습니다.');
    } else {
      // Move canvas item to staging
      dispatch({ type: 'MOVE_TO_STAGING', payload: selectedItem.templateItemId });
      toast.info('아이템이 임시 저장 공간으로 이동되었습니다.');
    }
  };

  const handleMoveToCanvas = () => {
    if (!selectedItem || !isFromStaging) return;
    dispatch({ type: 'MOVE_TO_CANVAS', payload: selectedItem.templateItemId });
    toast.success('아이템이 캔버스에 추가되었습니다.');
  };

  const renderIconGrid = (icons: typeof state.defaultIcons) => (
    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
      {icons.length === 0 ? (
        <div className="col-span-4 flex items-center justify-center py-4">
          <p className="text-xs text-muted-foreground">아이콘이 없습니다</p>
        </div>
      ) : (
        icons.map((icon) => (
          <button
            key={icon.id}
            onClick={() => setSelectedIconId(icon.id)}
            className={`
              aspect-square p-2 rounded-md border-2 transition-all
              ${
                selectedIconId === icon.id
                  ? 'border-primary bg-primary/10'
                  : 'border-transparent hover:border-gray-300'
              }
            `}
            title={icon.name}
            type="button"
          >
            <img
              src={icon.imageUrl}
              alt={icon.name}
              className="w-full h-full object-contain"
            />
          </button>
        ))
      )}
    </div>
  );

  return (
    <aside className="w-72 border-l bg-background overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="border-b pb-3">
          <h3 className="font-semibold text-sm">아이템 속성</h3>
          <p className="text-xs text-muted-foreground mt-1">
            선택된 아이템의 속성을 편집합니다
          </p>
        </div>

        {/* Name Input */}
        <div className="space-y-2">
          <Label htmlFor="item-name" className="text-xs">링크 이름 (최대 15자)</Label>
          <Input
            id="item-name"
            value={name}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= 15) {
                setName(value);
              }
            }}
            placeholder="예: 이캠퍼스"
            className="h-8 text-sm"
            maxLength={15}
          />
        </div>

        {/* URL Input */}
        <div className="space-y-2">
          <Label htmlFor="item-url" className="text-xs">링크 URL</Label>
          <Input
            id="item-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-8 text-sm"
          />
        </div>

        {/* Icon Selection */}
        <div className="space-y-2">
          <Label className="text-xs">아이콘</Label>
          <Tabs defaultValue="default" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="default" className="text-xs">
                기본 ({state.defaultIcons.length})
              </TabsTrigger>
              <TabsTrigger value="user" className="text-xs">
                내 아이콘 ({state.userIcons.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="default" className="mt-2">
              {renderIconGrid(state.defaultIcons)}
            </TabsContent>

            <TabsContent value="user" className="mt-2">
              {renderIconGrid(state.userIcons)}
            </TabsContent>
          </Tabs>
        </div>

        {/* Size Controls */}
        <div className="space-y-2">
          <Label className="text-xs">크기 (그리드 단위)</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="item-width" className="text-xs text-muted-foreground">너비</Label>
              <Input
                id="item-width"
                type="number"
                min={1}
                max={GRID_CONFIG.COLS}
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value) || 1)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="item-height" className="text-xs text-muted-foreground">높이</Label>
              <Input
                id="item-height"
                type="number"
                min={1}
                max={GRID_CONFIG.ROWS}
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value) || 1)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Position Controls */}
        <div className="space-y-2">
          <Label className="text-xs">위치 (그리드 좌표)</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="item-pos-x" className="text-xs text-muted-foreground">X</Label>
              <Input
                id="item-pos-x"
                type="number"
                min={0}
                max={GRID_CONFIG.COLS - 1}
                value={posX}
                onChange={(e) => setPosX(parseInt(e.target.value) || 0)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="item-pos-y" className="text-xs text-muted-foreground">Y</Label>
              <Input
                id="item-pos-y"
                type="number"
                min={0}
                max={GRID_CONFIG.ROWS - 1}
                value={posY}
                onChange={(e) => setPosY(parseInt(e.target.value) || 0)}
                className="h-8 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <Button
            onClick={handleSave}
            className="w-full h-9"
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            변경사항 저장
          </Button>

          {isFromStaging ? (
            <>
              <Button
                onClick={handleMoveToCanvas}
                className="w-full h-9"
                size="sm"
                variant="outline"
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                캔버스에 추가
              </Button>
              <Button
                onClick={handleDelete}
                variant="destructive"
                className="w-full h-9"
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                영구 삭제
              </Button>
            </>
          ) : (
            <Button
              onClick={handleDelete}
              variant="destructive"
              className="w-full h-9"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              임시 저장 공간으로 이동
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          {isFromStaging ? (
            <>
              <p>💡 임시 저장 공간의 아이템입니다</p>
              <p>💡 드래그하여 캔버스에 추가 가능</p>
              <p>💡 영구 삭제 시 복구할 수 없습니다</p>
            </>
          ) : (
            <>
              <p>💡 드래그하여 위치 조절</p>
              <p>💡 우하단 핸들로 크기 조절</p>
              <p>💡 캔버스를 클릭하면 선택 해제</p>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
