import { cn } from '@/lib/utils';

type Props = {
  /** Already formatted, e.g. "Oct 26, 1:01 PM" */
  start: string;
  deadline: string;
  /** Deadline shown in red */
  missed?: boolean;
  className?: string;
};

const label = 'text-[10.5px] font-semibold uppercase tracking-[0.06em]';

// Scheduled Start and Deadline side by side (spec §7.3). `tone` is the card
// the boxes sit on: dark (running-task card), light (white cards).
export function ScheduleBoxes({ start, deadline, missed, tone = 'light', className }: Props & { tone?: 'light' | 'dark' }) {
  const box = cn('flex flex-col gap-px rounded-xl px-3 py-2', tone === 'dark' ? 'bg-dark-1 text-white' : 'bg-surface-2 text-ink');
  const lbl = cn(label, tone === 'dark' ? 'opacity-65' : 'text-ink-3');
  const due = missed ? (tone === 'dark' ? 'text-missed-on-dark' : 'text-missed') : '';
  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      <div className={box}>
        <span className={lbl}>Start</span>
        <span className="text-[13px] font-semibold">{start}</span>
      </div>
      <div className={box}>
        <span className={lbl}>Deadline</span>
        <span className={cn('text-[13px] font-semibold', due)}>{deadline}</span>
      </div>
    </div>
  );
}

// Compact two-line form used in task table rows: labels left, values right.
export function ScheduleInline({ start, deadline, missed, className }: Props) {
  return (
    <span className={cn('grid min-w-0 grid-cols-[auto_1fr] items-baseline gap-x-2.5 gap-y-px text-[13px]', className)}>
      <span className={cn(label, 'tracking-[0.05em] text-ink-3')}>Start</span>
      <span className="font-semibold">{start}</span>
      <span className={cn(label, 'tracking-[0.05em] text-ink-3')}>Deadline</span>
      <span className={cn('font-semibold', missed ? 'text-missed' : 'text-ink-2')}>{deadline}</span>
    </span>
  );
}
