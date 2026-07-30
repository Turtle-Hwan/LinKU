import { useCallback, useEffect, useState } from "react";

import {
  calculateDDay,
  parseTodoDateTime,
} from "@/utils/todo/dateFormat";
import { shouldShowTimer } from "@/utils/todo/timer";

import TodoCountdown from "./TodoCountdown";

interface TodoDeadlineBadgeProps {
  dDay: string;
  dueDate?: string;
  dueTime?: string;
  timerEnabled: boolean;
}

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const MAX_TIMEOUT_MILLISECONDS = 2_147_000_000;

const getDdayBadgeClassName = (dDay: string) => {
  if (dDay === "마감" || dDay.startsWith("D+")) {
    return "px-2 py-1 bg-gray-900/10 text-gray-900 rounded-full text-xs";
  }

  return "px-2 py-1 bg-main/10 text-main rounded-full text-xs";
};

const getNextMidnightTimestamp = () => {
  const nextMidnight = new Date();
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);
  return nextMidnight.getTime();
};

/**
 * D-Day와 실시간 카운트다운 전환을 한 곳에서 관리한다.
 * 24시간 진입과 자정 경계에서만 다시 렌더링하고, 초 ticker는 countdown 중에만 구독한다.
 */
const TodoDeadlineBadge = ({
  dDay,
  dueDate,
  dueTime,
  timerEnabled,
}: TodoDeadlineBadgeProps) => {
  const [boundaryRevision, setBoundaryRevision] = useState(0);
  const deadline =
    dueDate && dueTime ? parseTodoDateTime(dueDate, dueTime) : null;
  const deadlineTimestamp = deadline?.getTime() ?? null;
  const calculatedDDay =
    deadline && dueDate && dueTime
      ? calculateDDay(dueDate, dueTime)
      : dDay;
  const showCountdown =
    timerEnabled &&
    dueDate !== undefined &&
    dueTime !== undefined &&
    shouldShowTimer(dueDate, dueTime);

  const refreshAtBoundary = useCallback(() => {
    setBoundaryRevision((revision) => revision + 1);
  }, []);

  useEffect(() => {
    if (deadlineTimestamp === null || showCountdown) return;

    const now = Date.now();
    const boundaryTimestamps = [getNextMidnightTimestamp()];
    const countdownStart = deadlineTimestamp - DAY_IN_MILLISECONDS;

    if (timerEnabled && countdownStart > now) {
      boundaryTimestamps.push(countdownStart);
    }

    const delay = Math.min(
      Math.max(100, Math.min(...boundaryTimestamps) - now + 50),
      MAX_TIMEOUT_MILLISECONDS,
    );
    const timeoutId = window.setTimeout(refreshAtBoundary, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    boundaryRevision,
    deadlineTimestamp,
    refreshAtBoundary,
    showCountdown,
    timerEnabled,
  ]);

  if (showCountdown && dueDate && dueTime) {
    return (
      <TodoCountdown
        dueDate={dueDate}
        dueTime={dueTime}
        onExpired={refreshAtBoundary}
      />
    );
  }

  return (
    <span className={getDdayBadgeClassName(calculatedDDay)}>
      {calculatedDDay}
    </span>
  );
};

export default TodoDeadlineBadge;
