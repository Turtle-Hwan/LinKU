/**
 * Email Verification Dialog
 * 건국대 이메일 인증 다이얼로그
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendVerificationCode, verifyEmailCode } from '@/apis/auth';
import {
  validateKonkukEmail,
  validateAuthCode,
} from '@/utils/formValidation';

interface EmailVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerificationComplete: () => void;
}

type Step = 'email' | 'code';

export function EmailVerificationDialog({
  open,
  onOpenChange,
  onVerificationComplete,
}: EmailVerificationDialogProps) {
  const [step, setStep] = useState<Step>('email');
  const [kuMail, setKuMail] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = async () => {
    // Validate email
    const validation = validateKonkukEmail(kuMail);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setIsLoading(true);
    try {
      const response = await sendVerificationCode({ kuMail });

      if (response.success) {
        toast.success('인증 코드가 발송되었습니다. 이메일을 확인해주세요.');
        setStep('code');
      } else {
        // Handle specific error codes
        const errorCode = response.error?.code;
        if (errorCode === '1005') {
          toast.error('올바른 건국대 이메일을 입력해주세요.');
        } else if (errorCode === '5014') {
          toast.error('이미 등록된 이메일입니다.');
        } else {
          toast.error(response.error?.message || '인증 코드 발송에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('Failed to send verification code:', error);
      toast.error('인증 코드 발송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    // Validate code
    const validation = validateAuthCode(authCode);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setIsLoading(true);
    try {
      const response = await verifyEmailCode({ kuMail, authCode });

      if (response.success) {
        toast.success('이메일 인증이 완료되었습니다!');
        // Store verified email
        await chrome.storage.local.set({ kuMail });
        // Trigger re-login to get member token
        onVerificationComplete();
        handleClose();
      } else {
        const errorCode = response.error?.code;
        if (errorCode === '5015') {
          toast.error('인증 코드가 올바르지 않습니다. 다시 확인해주세요.');
        } else {
          toast.error(response.error?.message || '인증에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('Failed to verify code:', error);
      toast.error('인증에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsLoading(true);
    try {
      const response = await sendVerificationCode({ kuMail });
      if (response.success) {
        toast.success('인증 코드가 재발송되었습니다.');
      } else {
        toast.error(response.error?.message || '재발송에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to resend code:', error);
      toast.error('재발송에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('email');
    setKuMail('');
    setAuthCode('');
    onOpenChange(false);
  };

  const handleBack = () => {
    setStep('email');
    setAuthCode('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'code' && (
              <button
                onClick={handleBack}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                disabled={isLoading}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Mail className="h-5 w-5" />
            건국대 이메일 인증
          </DialogTitle>
          <DialogDescription>
            {step === 'email'
              ? '건국대학교 이메일로 인증을 진행해주세요.'
              : `${kuMail}로 발송된 6자리 인증 코드를 입력해주세요.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 'email' ? (
            <div className="space-y-2">
              <label htmlFor="kuMail" className="text-sm font-medium">
                건국대 이메일
              </label>
              <Input
                id="kuMail"
                type="email"
                placeholder="student@konkuk.ac.kr"
                value={kuMail}
                onChange={(e) => setKuMail(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
              />
              <p className="text-xs text-muted-foreground">
                @konkuk.ac.kr 이메일만 사용 가능합니다.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="authCode" className="text-sm font-medium">
                  인증 코드
                </label>
                <Input
                  id="authCode"
                  type="text"
                  placeholder="6자리 숫자 입력"
                  value={authCode}
                  onChange={(e) => {
                    // Only allow digits, max 6
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setAuthCode(value);
                  }}
                  disabled={isLoading}
                  maxLength={6}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                  className="text-center text-lg tracking-widest"
                />
              </div>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
              >
                인증 코드 재발송
              </button>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row gap-2 sm:justify-end">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            취소
          </Button>
          {step === 'email' ? (
            <Button onClick={handleSendCode} disabled={isLoading || !kuMail.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  발송 중...
                </>
              ) : (
                '인증 코드 발송'
              )}
            </Button>
          ) : (
            <Button
              onClick={handleVerifyCode}
              disabled={isLoading || authCode.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  인증 중...
                </>
              ) : (
                '인증 완료'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
