export type SerializedAuthAttempt<T> =
  | { superseded: true }
  | { superseded: false; result: T };

export interface SerializedAuthQueue {
  run: <T>(
    isCurrent: () => boolean,
    authenticate: () => Promise<T>,
  ) => Promise<SerializedAuthAttempt<T>>;
}

/**
 * eCampus가 하나의 브라우저 세션을 공유하므로 로그인 요청을 순서대로 실행한다.
 * 뒤늦게 완료된 요청은 결과를 소비하지 않아 이전 계정 상태를 저장하거나 표시하지 않는다.
 */
export const createSerializedAuthQueue = (): SerializedAuthQueue => {
  let tail: Promise<void> = Promise.resolve();

  const run = <T>(
    isCurrent: () => boolean,
    authenticate: () => Promise<T>,
  ): Promise<SerializedAuthAttempt<T>> => {
    const execute = async (): Promise<SerializedAuthAttempt<T>> => {
      if (!isCurrent()) {
        return { superseded: true };
      }

      const result = await authenticate();
      return isCurrent()
        ? { superseded: false, result }
        : { superseded: true };
    };

    const attempt = tail.then(execute, execute);
    tail = attempt.then(
      () => undefined,
      () => undefined,
    );
    return attempt;
  };

  return { run };
};
