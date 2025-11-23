/**
 * Icon Upload Button - Upload custom icons (SVG, PNG, JPG)
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { createIcon } from '@/apis/icons';
import { toast } from 'sonner';
import type { Icon } from '@/types/api';

interface IconUploadButtonProps {
  onIconUploaded?: (icon: Icon) => void;
}

export const IconUploadButton = ({ onIconUploaded }: IconUploadButtonProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      toast.error('오류', {
        description: 'SVG, PNG, JPG 파일만 업로드 가능합니다.',
      });
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('오류', {
        description: '파일 크기는 5MB 이하이어야 합니다.',
      });
      return;
    }

    setIsUploading(true);

    try {
      // Extract icon name from file name (without extension)
      const iconName = file.name.replace(/\.[^/.]+$/, '');

      const result = await createIcon(iconName, file);

      if (result.success && result.data) {
        toast.success('업로드 완료', {
          description: `"${iconName}" 아이콘이 추가되었습니다.`,
        });

        // Notify parent component with icon data (result.data is CreateIconResponse which has Icon structure)
        if (onIconUploaded) {
          onIconUploaded(result.data);
        }
      } else {
        toast.error('업로드 실패', {
          description: result.error?.message || '아이콘 업로드에 실패했습니다.',
        });
      }
    } catch (error) {
      console.error('Icon upload error:', error);
      toast.error('오류', {
        description: '아이콘 업로드 중 오류가 발생했습니다.',
      });
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <Button
        onClick={handleButtonClick}
        disabled={isUploading}
        variant="outline"
        className="w-full"
        size="sm"
      >
        {isUploading ? (
          <>
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
            업로드 중...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            아이콘 업로드
          </>
        )}
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
};
