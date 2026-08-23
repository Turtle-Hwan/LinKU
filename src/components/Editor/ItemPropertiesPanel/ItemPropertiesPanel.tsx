/**
 * Item Properties Panel - Right sidebar for editing selected item properties
 * Allows editing name, URL, icon, size, and position
 */

import { useEffect, useState } from 'react';
import { useEditorContext } from '@/hooks/useEditorContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Save, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { GRID_CONFIG } from '@/utils/templateGrid';
import {
  getFirstValidationMessage,
  LINK_NAME_MAX_LENGTH,
  linkFormSchema,
} from '@/utils/formValidation';
import { IconGrid } from '@/components/Editor/shared/IconGrid';
import type { TemplateIcon, TemplateItem } from '@/types/api';
import { InputGroup } from '@/components/Editor/shared/InputGroup';
import { sendTemplateItemAdd, sendTemplateItemUpdate, sendTemplateItemDelete } from '@/utils/analytics';

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

  // No item selected
  if (!selectedItem || !state.template) {
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

  return (
    <ItemPropertiesPanelForm
      key={selectedItem.templateItemId}
      selectedItem={selectedItem}
      isFromStaging={isFromStaging}
      templateId={state.template?.templateId}
      templateHeight={state.template.height}
      defaultIcons={state.defaultIcons}
      userIcons={state.userIcons}
      dispatch={dispatch}
    />
  );
};

interface ItemPropertiesPanelFormProps {
  selectedItem: TemplateItem;
  isFromStaging: boolean;
  templateId: number | undefined;
  templateHeight: number;
  defaultIcons: ReturnType<typeof useEditorContext>['state']['defaultIcons'];
  userIcons: ReturnType<typeof useEditorContext>['state']['userIcons'];
  dispatch: ReturnType<typeof useEditorContext>['dispatch'];
}

const ItemPropertiesPanelForm = ({
  selectedItem,
  isFromStaging,
  templateId,
  templateHeight,
  defaultIcons,
  userIcons,
  dispatch,
}: ItemPropertiesPanelFormProps) => {
  // Local state for form fields
  const [name, setName] = useState(selectedItem.name);
  const [url, setUrl] = useState(selectedItem.siteUrl);
  const [selectedIconId, setSelectedIconId] = useState<number | null>(
    selectedItem.icon.iconId
  );
  const [width, setWidth] = useState(selectedItem.size.width.toString());
  const [height, setHeight] = useState(selectedItem.size.height.toString());
  const [posX, setPosX] = useState(selectedItem.position.x.toString());
  const [posY, setPosY] = useState(selectedItem.position.y.toString());

  useEffect(() => {
    setName(selectedItem.name);
    setUrl(selectedItem.siteUrl);
    setSelectedIconId(selectedItem.icon.iconId);
    setWidth(selectedItem.size.width.toString());
    setHeight(selectedItem.size.height.toString());
    setPosX(selectedItem.position.x.toString());
    setPosY(selectedItem.position.y.toString());
  }, [selectedItem]);

  const handleSave = () => {
    const validation = linkFormSchema.safeParse({
      name,
      url,
      iconId: selectedIconId,
    });
    if (!validation.success) {
      toast.error(getFirstValidationMessage(validation.error));
      return;
    }

    const { name: validatedName, url: validatedUrl, iconId } = validation.data;

    // Find selected icon
    const allIcons = [...defaultIcons, ...userIcons];
    const currentIconIsOrphaned =
      selectedItem.icon.iconId === iconId &&
      !allIcons.some(
        (candidate) =>
          candidate.id === iconId &&
          candidate.imageUrl === selectedItem.icon.iconUrl,
      );
    const icon = currentIconIsOrphaned
      ? {
          id: selectedItem.icon.iconId,
          name: selectedItem.icon.iconName,
          imageUrl: selectedItem.icon.iconUrl,
        }
      : allIcons.find((candidate) => candidate.id === iconId);
    if (!icon) {
      toast.error('선택한 아이콘을 찾을 수 없습니다.');
      return;
    }

    // Parse and validate size bounds
    const parsedWidth = parseInt(width) || 1;
    const parsedHeight = parseInt(height) || 1;
    const clampedWidth = Math.max(1, Math.min(GRID_CONFIG.COLS, parsedWidth));
    const clampedHeight = Math.max(1, Math.min(templateHeight, parsedHeight));

    // Parse and validate position bounds
    const parsedPosX = parseInt(posX) || 0;
    const parsedPosY = parseInt(posY) || 0;
    const clampedPosX = Math.max(0, Math.min(GRID_CONFIG.COLS - clampedWidth, parsedPosX));
    const clampedPosY = Math.max(0, Math.min(templateHeight - clampedHeight, parsedPosY));

    // Update item (use different action based on location)
    dispatch({
      type: isFromStaging ? 'UPDATE_STAGING_ITEM' : 'UPDATE_ITEM',
      payload: {
        id: selectedItem.templateItemId,
        changes: {
          name: validatedName,
          siteUrl: validatedUrl,
          icon: {
            iconId: icon.id,
            iconName: icon.name,
            iconUrl: icon.imageUrl,
          } as TemplateIcon,
          size: { width: clampedWidth, height: clampedHeight },
          position: { x: clampedPosX, y: clampedPosY },
        },
      },
    });

    sendTemplateItemUpdate('properties', templateId);
    toast.success('변경사항이 저장되었습니다.');
  };

  const handleDelete = () => {
    if (isFromStaging) {
      // Permanently delete from staging
      dispatch({ type: 'REMOVE_FROM_STAGING', payload: selectedItem.templateItemId });
      sendTemplateItemDelete('staging', templateId);
      toast.info('아이템이 영구 삭제되었습니다.');
    } else {
      // Move canvas item to staging
      dispatch({ type: 'MOVE_TO_STAGING', payload: selectedItem.templateItemId });
      sendTemplateItemDelete('canvas', templateId);
      toast.info('아이템이 임시 저장 공간으로 이동되었습니다.');
    }
  };

  const handleMoveToCanvas = () => {
    if (!isFromStaging) return;
    dispatch({ type: 'MOVE_TO_CANVAS', payload: selectedItem.templateItemId });
    sendTemplateItemAdd('button', templateId);
    toast.success('아이템이 캔버스에 추가되었습니다.');
  };

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
          <Label htmlFor="item-name" className="text-xs">
            링크 이름 (최대 {LINK_NAME_MAX_LENGTH}자)
          </Label>
          <Input
            id="item-name"
            value={name}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= LINK_NAME_MAX_LENGTH) {
                setName(value);
              }
            }}
            placeholder="예: 이캠퍼스"
            className="h-8"
            maxLength={LINK_NAME_MAX_LENGTH}
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
            className="h-8"
          />
        </div>

        {/* Icon Selection */}
        <div className="space-y-2">
          <Label className="text-xs">아이콘</Label>
          <Tabs defaultValue="default" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="default" className="text-xs">
                기본 ({defaultIcons.length})
              </TabsTrigger>
              <TabsTrigger value="user" className="text-xs">
                내 아이콘 ({userIcons.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="default" className="mt-2">
              <IconGrid
                icons={defaultIcons}
                selectedIconId={selectedIconId}
                onSelectIcon={setSelectedIconId}
                columns={4}
              />
            </TabsContent>

            <TabsContent value="user" className="mt-2">
              <IconGrid
                icons={userIcons}
                selectedIconId={selectedIconId}
                onSelectIcon={setSelectedIconId}
                columns={4}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Size Controls */}
        <InputGroup
          title="크기 (그리드 단위)"
          fields={[
            {
              id: 'item-width',
              label: '너비',
              value: width,
              onChange: setWidth,
              min: 1,
              max: GRID_CONFIG.COLS,
            },
            {
              id: 'item-height',
              label: '높이',
              value: height,
              onChange: setHeight,
              min: 1,
              max: templateHeight,
            },
          ]}
        />

        {/* Position Controls */}
        <InputGroup
          title="위치 (그리드 좌표)"
          fields={[
            {
              id: 'item-pos-x',
              label: 'X',
              value: posX,
              onChange: setPosX,
              min: 0,
              max: GRID_CONFIG.COLS - 1,
            },
            {
              id: 'item-pos-y',
              label: 'Y',
              value: posY,
              onChange: setPosY,
              min: 0,
              max: templateHeight - 1,
            },
          ]}
        />

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
