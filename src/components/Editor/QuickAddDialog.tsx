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
    // Validation
    if (!name.trim()) {
      toast.error('링크 이름을 입력해주세요.');
      return;
    }

    if (!url.trim()) {
      toast.error('링크 URL을 입력해주세요.');
      return;
    }

    // Basic URL validation
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

    // Add link with iconId
    onAdd({
      name: name.trim(),
      url: url.trim(),
      iconId: selectedIconId,
    });

    // Close dialog
    onOpenChange(false);
  };

  const renderIconGrid = (icons: typeof state.defaultIcons) => (
    <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto p-2 border rounded-md">
      {icons.length === 0 ? (
        <div className="col-span-8 flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">아이콘이 없습니다</p>
        </div>
      ) : (
        icons.map((icon) => (
          <button
            key={icon.id}
            onClick={() => setSelectedIconId(icon.id)}
            className={`
              p-2 rounded-md border-2 transition-all
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
            <Label htmlFor="link-name">링크 이름</Label>
            <Input
              id="link-name"
              placeholder="예: 이캠퍼스"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
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
                {renderIconGrid(state.defaultIcons)}
              </TabsContent>

              <TabsContent value="user" className="mt-2">
                {renderIconGrid(state.userIcons)}
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
