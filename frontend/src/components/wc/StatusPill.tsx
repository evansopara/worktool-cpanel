import { cn } from '@/lib/utils';

export type StatusTone = 'missed' | 'pending' | 'done' | 'review' | 'todo';

const TONES: Record<StatusTone, string> = {
  missed: 'bg-missed-tint text-missed',
  pending: 'bg-pending-tint text-pending',
  done: 'bg-done-tint text-done',
  review: 'bg-review-tint text-review',
  todo: 'bg-todo-tint text-todo',
};

// Maps a task status from the API to its pill colour. "In progress" uses the
// pending (amber) tint, as on the Tasks artboard.
export function statusTone(status: string): StatusTone {
  const s = status.toLowerCase().replace(/[_-]/g, ' ');
  if (s.includes('missed') || s.includes('overdue') || s.includes('declined') || s.includes('rejected')) return 'missed';
  if (s.includes('review')) return 'review';
  if (s.includes('complete') || s.includes('done') || s.includes('approved')) return 'done';
  if (s.includes('progress') || s.includes('pending') || s.includes('extension')) return 'pending';
  return 'todo';
}

// Status on one line as a pill (spec §7.1).
export function StatusPill({
  tone,
  size = 'sm',
  className,
  children,
}: {
  tone: StatusTone;
  size?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-block rounded-full font-semibold whitespace-nowrap leading-[1.3]',
        size === 'sm' ? 'px-2.5 py-[5px] text-xs' : 'px-3 py-[5px] text-[13px]',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
