import { useState, useEffect } from 'react';

function parseUTC(dateStr: string): number {
  if (dateStr.endsWith('Z') || dateStr.includes('+')) {
    return new Date(dateStr).getTime();
  }
  return new Date(dateStr.replace(' ', 'T') + 'Z').getTime();
}

/**
 * Forces a re-render every second while the timer is running.
 * The display value is computed fresh each render from Date.now().
 */
export function useTaskTimer(
  timeSpent: number | undefined,
  isRunning: boolean,
  timerStartTime: string | undefined
): number {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  const base = timeSpent ?? 0;
  if (!isRunning || !timerStartTime) return base;

  const elapsed = Math.max(0, Math.floor((Date.now() - parseUTC(timerStartTime)) / 1000));
  return base + elapsed;
}
