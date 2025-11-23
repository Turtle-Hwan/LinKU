/**
 * Google Login Button Component
 * Handles OAuth authentication using chrome.identity API
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { startGoogleLogin, logout, isLoggedIn } from '@/utils/oauth';
import { toast } from 'sonner';

export const LoginButton = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check login status on mount
  useEffect(() => {
    checkLoginStatus();
  }, []);

  // Listen for auth events
  useEffect(() => {
    const handleLogout = () => setLoggedIn(false);
    const handleUnauthorized = () => {
      setLoggedIn(false);
      toast.error('세션이 만료되었습니다. 다시 로그인해주세요.');
    };

    window.addEventListener('auth:logout', handleLogout);
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth:logout', handleLogout);
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const checkLoginStatus = async () => {
    try {
      const status = await isLoggedIn();
      setLoggedIn(status);
    } catch (error) {
      console.error('Failed to check login status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);

    try {
      const result = await startGoogleLogin();

      if (result.success) {
        setLoggedIn(true);
        toast.success('로그인 성공', {
          description: 'Google 계정으로 로그인되었습니다.',
        });

        // Refresh the page to load user data
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        // Handle different error types
        let errorTitle = '로그인 실패';
        let errorDescription = result.error;

        if (result.error.includes('닫혔습니다')) {
          errorDescription = '로그인 창이 닫혔습니다. 다시 시도해주세요.';
        } else if (result.error.includes('중단')) {
          errorDescription = '로그인이 중단되었습니다. 다시 시도해주세요.';
        } else if (result.error.includes('네트워크') || result.error.includes('Network')) {
          errorTitle = '네트워크 오류';
          errorDescription = '인터넷 연결을 확인하고 다시 시도해주세요.';
        }

        toast.error(errorTitle, {
          description: errorDescription,
        });
      }
    } catch (error) {
      toast.error('오류', {
        description: '예상치 못한 오류가 발생했습니다.',
      });
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setLoggedIn(false);
      toast.success('로그아웃', {
        description: '로그아웃되었습니다.',
      });

      // Refresh the page
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      toast.error('오류', {
        description: '로그아웃 중 오류가 발생했습니다.',
      });
      console.error('Logout error:', error);
    }
  };

  if (checking) {
    return (
      <Button disabled variant="outline" size="sm">
        확인 중...
      </Button>
    );
  }

  if (loggedIn) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">로그인됨</span>
        <Button onClick={handleLogout} variant="outline" size="sm">
          로그아웃
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleLogin}
      disabled={loading}
      variant="default"
      size="sm"
    >
      {loading ? '로그인 중...' : 'Google 로그인'}
    </Button>
  );
};
