/**
 * 404 Not Found Page
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full h-screen flex items-center justify-center bg-background p-8">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <h2 className="text-2xl font-semibold">페이지를 찾을 수 없습니다</h2>
        <p className="text-muted-foreground">
          요청하신 페이지가 존재하지 않습니다.
        </p>
        <Button onClick={() => navigate('/')} variant="default">
          홈으로 돌아가기
        </Button>
      </div>
    </div>
  );
};
