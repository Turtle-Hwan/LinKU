/**
 * Sync Button - Sync template to server
 */

import { Button } from '@/components/ui/button';
import { CloudUpload } from 'lucide-react';

interface SyncButtonProps {
  onSync: () => void | Promise<void>;
  isSyncing: boolean;
  disabled?: boolean;
}

export const SyncButton = ({
  onSync,
  isSyncing,
  disabled,
}: SyncButtonProps) => {
  return (
    <Button
      onClick={onSync}
      disabled={isSyncing || disabled}
      variant="outline"
      size="sm"
    >
      <CloudUpload className="h-4 w-4 mr-2" />
      {isSyncing ? '동기화 중...' : '서버 동기화'}
    </Button>
  );
};
