'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { fmtClock } from '@/lib/tasks';

/**
 * Time logged, ticking every second while the timer runs. `seconds` is the
 * server's logged_seconds at `since` (when the data was fetched).
 */
export function useLiveSeconds(seconds: number, running: boolean, since: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  return running ? seconds + Math.max(0, (now - since) / 1000) : seconds;
}

// Pulsing green dot while running, grey when stopped (spec §7.5).
export function TimerDot({ running, className }: { running: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('shrink-0 rounded-full', running ? 'animate-wcpulse bg-live motion-reduce:animate-none' : 'bg-idle', className)}
    />
  );
}

export function LiveClock({
  seconds,
  running,
  since,
  className,
}: {
  seconds: number;
  running: boolean;
  since: number;
  className?: string;
}) {
  const value = useLiveSeconds(seconds, running, since);
  return (
    <span role="timer" aria-label={`Time logged ${fmtClock(value)}`} className={cn('font-mono font-semibold', className)}>
      {fmtClock(value)}
    </span>
  );
}
