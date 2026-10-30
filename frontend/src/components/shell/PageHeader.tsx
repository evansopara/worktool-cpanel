import { cn } from '@/lib/utils';

// Page frame title block (spec §4): optional eyebrow, 56px title (40px on
// mobile), one-line description, actions on the right.
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-5 pt-2 pb-1', className)}>
      <div className="flex flex-col gap-2.5">
        {eyebrow && <p className="m-0 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">{eyebrow}</p>}
        <h1 className="m-0 font-display text-[40px] leading-none font-bold tracking-[-0.04em] lg:text-[56px]">{title}</h1>
        {description && <p className="m-0 text-[15px] text-ink-2 lg:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </header>
  );
}

// Content column for redesigned pages: 1280px max, 40px side padding on
// desktop, 18px on mobile.
export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto flex w-full max-w-content flex-col gap-[22px] px-[18px] pt-14 pb-10 lg:px-10 lg:pt-7 lg:pb-[72px]', className)}>
      {children}
    </div>
  );
}
