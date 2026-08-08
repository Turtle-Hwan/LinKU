type TickListener = () => void;

const listeners = new Set<TickListener>();
let intervalId: number | null = null;

const startTicker = () => {
  if (intervalId !== null) {
    return;
  }

  intervalId = window.setInterval(() => {
    listeners.forEach((listener) => listener());
  }, 1000);
};

const stopTicker = () => {
  if (intervalId === null || listeners.size > 0) {
    return;
  }

  window.clearInterval(intervalId);
  intervalId = null;
};

export const subscribeSecondTick = (listener: TickListener) => {
  listeners.add(listener);
  startTicker();

  return () => {
    listeners.delete(listener);
    stopTicker();
  };
};
