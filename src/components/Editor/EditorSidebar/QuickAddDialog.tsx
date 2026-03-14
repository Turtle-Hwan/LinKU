/**
 * Quick Add Dialog
 * Allows quick addition of links to the template with icon selection
 * Includes both default and user-uploaded icons
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEditorContext } from '@/contexts/EditorContext';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { validateLinkForm } from '@/utils/formValidation';
import { IconGrid } from '@/components/Editor/shared/IconGrid';

interface QuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: { name: string; url: string; iconId: number }) => void;
}

export const QuickAddDialog = ({ open, onOpenChange, onAdd }: QuickAddDialogProps) => {
  const { state } = useEditorContext();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedIconId, setSelectedIconId] = useState<number | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setUrl('');
      // Auto-select first available icon
      const firstIcon = state.defaultIcons[0] || state.userIcons[0];
      if (firstIcon) {
        setSelectedIconId(firstIcon.id);
      } else {
        setSelectedIconId(null);
      }
    }
  }, [open, state.defaultIcons, state.userIcons]);

  const handleAdd = () => {
    // Validate form using centralized validation
    const validation = validateLinkForm(name, url, selectedIconId, 15);
    if (!validation.valid) {
      toast.error(validation.error!);
      return;
    }

    // Add link with iconId
    onAdd({
      name: name.trim(),
      url: url.trim(),
      iconId: selectedIconId!,
    });

    // Close dialog
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>빠른 링크 추가</DialogTitle>
          <DialogDescription>
            링크 정보를 입력하고 아이콘을 선택하면 임시 저장 공간에 추가됩니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="link-name">링크 이름 (최대 15자)</Label>
            <Input
              id="link-name"
              placeholder="예: 이캠퍼스"
              value={name}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= 15) {
                  setName(value);
                }
              }}
              autoComplete="off"
              maxLength={15}
            />
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="link-url">링크 URL</Label>
            <Input
              id="link-url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Icon Selection with Tabs */}
          <div className="space-y-2">
            <Label>아이콘 선택</Label>
            <Tabs defaultValue="default" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="default">
                  기본 아이콘 ({state.defaultIcons.length})
                </TabsTrigger>
                <TabsTrigger value="user">
                  내 아이콘 ({state.userIcons.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="default" className="mt-2">
                <IconGrid
                  icons={state.defaultIcons}
                  selectedIconId={selectedIconId}
                  onSelectIcon={setSelectedIconId}
                  columns={8}
                  maxHeight="max-h-64"
                />
              </TabsContent>

              <TabsContent value="user" className="mt-2">
                <IconGrid
                  icons={state.userIcons}
                  selectedIconId={selectedIconId}
                  onSelectIcon={setSelectedIconId}
                  columns={8}
                  maxHeight="max-h-64"
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
