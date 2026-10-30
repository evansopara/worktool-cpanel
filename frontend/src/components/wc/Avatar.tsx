import { cn } from '@/lib/utils';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-[15px]',
};

const TONES = {
  yellow: 'bg-yellow text-ink',
  ink: 'bg-ink text-white',
  stone: 'bg-stone text-ink',
};

// Initials in a circle. Not used in the task table (spec §3).
export function Avatar({
  name,
  size = 'md',
  tone = 'yellow',
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center rounded-full font-ui font-bold', SIZES[size], TONES[tone], className)}
    >
      {initials(name)}
    </span>
  );
}
