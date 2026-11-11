import { cn } from '@/lib/utils';

// Yellow count badge for pending items (nav, tabs). Renders nothing at zero.
export function Badge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-yellow px-[5px] font-ui text-[11px] font-bold text-ink',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
