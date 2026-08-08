export interface ECampusTodoLoadState<T> {
  success: boolean;
  todos: T[];
  needsLogin?: boolean;
}

/**
 * 일시적인 요청 실패에는 마지막 정상 목록을 유지하고, 인증이 해제됐을 때만 비운다.
 */
export const resolveECampusTodosAfterLoad = <T>(
  previousTodos: T[],
  result: ECampusTodoLoadState<T>,
): T[] => {
  if (result.success) {
    return result.todos;
  }

  return result.needsLogin ? [] : previousTodos;
};
