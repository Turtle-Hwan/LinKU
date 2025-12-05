/**
 * Back Button - Navigate back from editor with unsaved changes warning
 */

import { useNavigate } from 'react-router-dom';
import { useEditorContext } from '@/contexts/EditorContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const BackButton = () => {
  const navigate = useNavigate();
  const { state } = useEditorContext();

  const handleBack = () => {
    if (state.isDirty) {
      const confirmed = window.confirm(
        '저장하지 않은 변경사항이 있습니다. 나가시겠습니까?'
      );
      if (!confirmed) return;
    }

    // Navigate to template list page
    navigate('/templates');
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleBack}>
      <ArrowLeft className="h-4 w-4 mr-2" />
      뒤로
    </Button>
  );
};
