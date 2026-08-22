/**
 * Icon Upload Dialog - Modal for uploading custom icons with preview
 */

import { useState, useRef, useEffect } from 'react';
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
import { Upload, ImageIcon, X } from 'lucide-react';
import { createLocalIcon } from '@/utils/localIcons';
import { toast } from 'sonner';
import type { Icon } from '@/types/api';
import { errorLog } from '@/utils/logger';

interface IconUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIconUploaded?: (icon: Icon) => void;
}

const VALID_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

export const IconUploadDialog = ({
  open,
  onOpenChange,
  onIconUploaded,
}: IconUploadDialogProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [iconName, setIconName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setIconName('');
      setIsUploading(false);
      setIsDragging(false);
    }
  }, [open]);

  const validateFile = (file: File): string | null => {
    if (!VALID_TYPES.includes(file.type)) {
      return 'SVG, PNG, JPG, WebP 파일만 사용할 수 있습니다.';
    }
    if (file.size > MAX_SIZE) {
      return '파일 크기는 5MB 이하이어야 합니다.';
    }
    return null;
  };

  const handleFileSelect = (selectedFile: File) => {
    const error = validateFile(selectedFile);
    if (error) {
      toast.error('오류', { description: error });
      return;
    }

    setFile(selectedFile);

    // Generate preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);

    // Set default icon name from filename (without extension)
    const defaultName = selectedFile.name.replace(/\.[^/.]+$/, '');
    setIconName(defaultName);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setPreview(null);
    setIconName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!file || !iconName.trim()) {
      toast.error('오류', { description: '파일과 아이콘 이름을 입력해주세요.' });
      return;
    }

    setIsUploading(true);

    try {
      const icon = await createLocalIcon(iconName.trim(), file);
      toast.success('업로드 완료', {
        description: `"${iconName.trim()}" 아이콘이 추가되었습니다.`,
      });

      if (onIconUploaded) {
        onIconUploaded(icon);
      }

      onOpenChange(false);
    } catch (error) {
      errorLog('Icon upload error:', error);
      toast.error('업로드 실패', {
        description:
          error instanceof Error
            ? error.message
            : '아이콘 업로드 중 오류가 발생했습니다.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>아이콘 업로드</DialogTitle>
          <DialogDescription>
            아이콘은 이 기기에 WebP로 변환해 저장합니다. (최대 5MB)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Upload Area */}
          <div
            onClick={() => !file && fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
              ${!file ? 'cursor-pointer hover:border-primary hover:bg-muted/50' : ''}
              ${isDragging ? 'border-primary bg-muted/50' : 'border-muted-foreground/25'}
            `}
          >
            {/* X button at top-right of upload area */}
            {preview && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearFile();
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}

            {preview ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={preview}
                  alt="Preview"
                  className="h-16 w-16 object-contain rounded"
                />
                <p className="text-xs text-muted-foreground truncate max-w-full">
                  {file?.name}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <ImageIcon className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium">클릭하여 파일 선택</p>
                <p className="text-xs text-muted-foreground">또는 드래그 앤 드롭</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Icon Name Input */}
          <div className="space-y-2">
            <Label htmlFor="icon-name">아이콘 이름</Label>
            <Input
              id="icon-name"
              placeholder="예: my-icon"
              value={iconName}
              onChange={(e) => setIconName(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleUpload} disabled={!file || !iconName.trim() || isUploading}>
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                업로드 중...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                업로드
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
