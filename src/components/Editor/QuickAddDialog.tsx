/**
 * Quick Add Dialog
 * Allows quick addition of links to the template with icon selection
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
import { getDefaultIcons } from '@/apis/icons';
import type { Icon } from '@/types/api';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface QuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: { name: string; url: string; iconId: number }) => void;
}

export const QuickAddDialog = ({ open, onOpenChange, onAdd }: QuickAddDialogProps) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedIconId, setSelectedIconId] = useState<number | null>(null);
  const [icons, setIcons] = useState<Icon[]>([]);
  const [loading, setLoading] = useState(false);

  // Load icons when dialog opens
  useEffect(() => {
    if (open) {
      loadIcons();
      // Reset form
      setName('');
      setUrl('');
      setSelectedIconId(null);
    }
  }, [open]);

  const loadIcons = async () => {
    setLoading(true);
    try {
      const result = await getDefaultIcons();
      if (result.success && result.data) {
        setIcons(result.data);
        // Auto-select first icon
        if (result.data.length > 0) {
          setSelectedIconId(result.data[0].iconId);
        }
      }
    } catch (error) {
      console.error('Failed to load icons:', error);
      toast.error('아이콘을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

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

    // Add link
    onAdd({
      name: name.trim(),
      url: url.trim(),
      iconId: selectedIconId,
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
            링크 정보를 입력하고 아이콘을 선택하면 자동으로 캔버스에 추가됩니다.
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

          {/* Icon Selection */}
          <div className="space-y-2">
            <Label>아이콘 선택</Label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">아이콘 로딩 중...</p>
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto p-2 border rounded-md">
                {icons.map((icon) => (
                  <button
                    key={icon.iconId}
                    onClick={() => setSelectedIconId(icon.iconId)}
                    className={`
                      p-2 rounded-md border-2 transition-all
                      ${
                        selectedIconId === icon.iconId
                          ? 'border-primary bg-primary/10'
                          : 'border-transparent hover:border-gray-300'
                      }
                    `}
                    title={icon.iconName}
                    type="button"
                  >
                    <img
                      src={icon.iconUrl}
                      alt={icon.iconName}
                      className="w-full h-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleAdd} disabled={loading}>
            <Plus className="h-4 w-4 mr-2" />
            추가
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
