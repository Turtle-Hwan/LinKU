/**
 * Publish Button - Publish template to public gallery
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Share2 } from 'lucide-react';

interface PublishButtonProps {
  onPublish: () => void | Promise<void>;
  disabled?: boolean;
}

export const PublishButton = ({ onPublish, disabled }: PublishButtonProps) => {
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await onPublish();
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <Button
      onClick={handlePublish}
      disabled={disabled || isPublishing}
      variant="outline"
      size="sm"
    >
      <Share2 className="h-4 w-4 mr-2" />
      {isPublishing ? '게시 중...' : '게시'}
    </Button>
  );
};
