'use client';

import { Clock } from 'lucide-react';
import { useTaskTimer } from '@/hooks/useTaskTimer';

interface Props {
  timeSpent?: number;
  isRunning: boolean;
  timerStartTime?: string;
}

function fmt(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(t / 3600).toString().padStart(2, '0');
  const m = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(t % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function TimerCell({ timeSpent, isRunning, timerStartTime }: Props) {
  const total = useTaskTimer(timeSpent, isRunning, timerStartTime);

  return (
    <span className={`flex items-center gap-1.5 text-xs font-mono ${isRunning ? 'text-blue-600 font-medium' : 'text-muted-foreground'}`}>
      <Clock className="w-3.5 h-3.5 shrink-0" />
      {fmt(total)}
    </span>
  );
}
