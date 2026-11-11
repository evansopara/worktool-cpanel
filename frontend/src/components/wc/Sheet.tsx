'use client';

import { Dialog } from '@base-ui/react/dialog';
import { cn } from '@/lib/utils';

// Prompt dialog (read-before-start, early start, confirmations). Below lg it
// is a bottom sheet with a grabber; at lg and up a centred 560px card, as on
// the StaffTasks / MStaffTasks artboards.
export function Sheet({
  open,
  onOpenChange,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-ink/50 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col gap-3.5 overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-3 pb-[max(34px,env(safe-area-inset-bottom))] font-ui text-ink outline-none transition-[translate,opacity] duration-250 ease-out',
            'data-ending-style:translate-y-full data-starting-style:translate-y-full',
            'lg:inset-x-auto lg:bottom-auto lg:top-1/2 lg:left-1/2 lg:w-[calc(100%-48px)] lg:max-w-[560px] lg:max-h-[90vh] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:gap-4 lg:rounded-[30px] lg:p-7',
            'lg:data-ending-style:-translate-y-[46%] lg:data-ending-style:opacity-0 lg:data-starting-style:-translate-y-[46%] lg:data-starting-style:opacity-0',
            className,
          )}
        >
          <span aria-hidden="true" className="h-[5px] w-11 shrink-0 self-center rounded-full bg-handle lg:hidden" />
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const EYEBROW_TONES = { pending: 'text-pending', done: 'text-done', ink: 'text-ink-2' };

// Small uppercase line above the title, e.g. "Read before you start".
export function SheetEyebrow({
  tone = 'pending',
  children,
}: {
  tone?: keyof typeof EYEBROW_TONES;
  children: React.ReactNode;
}) {
  return (
    <p className={cn('m-0 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.07em] lg:text-[12.5px] [&_svg]:size-[15px]', EYEBROW_TONES[tone])}>
      {children}
    </p>
  );
}

export function SheetTitle({ children }: { children: React.ReactNode }) {
  return (
    <Dialog.Title className="m-0 font-display text-2xl leading-[1.12] font-bold lg:text-[30px] lg:leading-[1.08] lg:tracking-[-0.02em]">
      {children}
    </Dialog.Title>
  );
}

export function SheetDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Dialog.Description className={cn('m-0 text-[13px] text-ink-3 lg:text-[13.5px]', className)}>{children}</Dialog.Description>;
}

// Confirm + cancel. Mobile: full-width primary on top, text-style cancel
// under it. Desktop: cancel (stone) left, primary (ink) right and wider.
export function SheetActions({
  confirmLabel,
  onConfirm,
  cancelLabel = 'Cancel',
  confirmDisabled,
}: {
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string;
  confirmDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 lg:flex-row lg:flex-wrap lg:gap-2.5">
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        className="h-[54px] cursor-pointer rounded-full border-0 bg-ink font-ui text-base font-bold text-white outline-none hover:bg-black focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-40 lg:order-2 lg:h-[52px] lg:flex-[2_1_200px] lg:text-[15px]"
      >
        {confirmLabel}
      </button>
      <Dialog.Close className="h-[46px] cursor-pointer rounded-full border-0 bg-transparent font-ui text-[15px] font-semibold text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-ink lg:order-1 lg:h-[52px] lg:flex-[1_1_140px] lg:bg-stone lg:text-ink">
        {cancelLabel}
      </Dialog.Close>
    </div>
  );
}
