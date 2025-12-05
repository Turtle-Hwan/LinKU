/**
 * Save Button - Manually save template
 */

import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

interface SaveButtonProps {
  onSave: () => void | Promise<void>;
  isSaving: boolean;
  disabled?: boolean;
}

export const SaveButton = ({ onSave, isSaving, disabled }: SaveButtonProps) => {
  return (
    <Button
      onClick={onSave}
      disabled={isSaving || disabled}
      variant="default"
      size="sm"
    >
      <Save className="h-4 w-4 mr-2" />
      {isSaving ? '저장 중...' : '저장'}
    </Button>
  );
};
