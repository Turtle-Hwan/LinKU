import { useState, useEffect } from 'react';
import { calculateTimeLeft, formatTimeLeft, isUrgent } from '@/utils/todo/timer';
import { calculateDDay } from '@/utils/todo/dateFormat';
import { subscribeSecondTick } from '@/utils/todo/secondTicker';

interface TodoCountdownProps {
  dueDate: string; // "YYYY.MM.DD"
  dueTime: string; // "HH:mm"
  onExpired?: (dDay: string) => void; // 타이머 만료 시 콜백
}

/**
 * 실시간 카운트다운 타이머 컴포넌트
 * 1초마다 업데이트되며, 12시간 이하 남으면 빨간색 표시
 * 타이머가 만료되면 D-Day 형식으로 표시
 */
const TodoCountdown = ({ dueDate, dueTime, onExpired }: TodoCountdownProps) => {
  const [timeDisplay, setTimeDisplay] = useState<string>('');
  const [urgent, setUrgent] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateTimer = (): boolean => {
      const timeLeft = calculateTimeLeft(dueDate, dueTime);

      if (!timeLeft) {
        const dDay = calculateDDay(dueDate, dueTime);
        setTimeDisplay(dDay);
        setUrgent(false);
        setIsExpired(true);

        if (onExpired) {
          onExpired(dDay);
        }
        return true;
      }

      setTimeDisplay(formatTimeLeft(timeLeft));
      setUrgent(isUrgent(timeLeft));
      setIsExpired(false);
      return false;
    };

    const isExpiredNow = updateTimer();
    if (isExpiredNow) {
      return;
    }

    let unsubscribe: (() => void) | null = null;

    unsubscribe = subscribeSecondTick(() => {
      const shouldStop = updateTimer();
      if (shouldStop && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [dueDate, dueTime, onExpired]);

  const badgeClassName = isExpired
    ? timeDisplay === '마감' || timeDisplay.startsWith('D+')
      ? 'px-2 py-1 bg-gray-900/10 text-gray-900 rounded-full text-xs font-normal'
      : 'px-2 py-1 bg-main/10 text-main rounded-full text-xs font-normal'
    : `px-2 py-1 bg-main/10 rounded-full text-xs font-mono ${
        urgent ? 'text-red-500 font-semibold' : 'text-main'
      }`;

  return (
    <span className={badgeClassName}>
      {timeDisplay}
    </span>
  );
};

export default TodoCountdown;
