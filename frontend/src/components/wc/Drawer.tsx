'use client';

import { Dialog } from '@base-ui/react/dialog';
import { cn } from '@/lib/utils';

// Task panel container (spec §7.9): a 620px drawer from the right at lg and
// up, a full-screen sheet below it (covers the mobile dock). The content
// supplies its own header and a <DrawerClose>.
export function Drawer({
  open,
  onOpenChange,
  label,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Accessible name, e.g. "Task details and history" */
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-ink/42 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          aria-label={label}
          className={cn(
            'fixed inset-0 z-50 overflow-y-auto bg-surface font-ui text-ink outline-none transition-transform duration-250 ease-out',
            'data-ending-style:translate-y-full data-starting-style:translate-y-full',
            'lg:left-auto lg:w-full lg:max-w-[620px] lg:rounded-l-[28px] lg:shadow-drawer',
            'lg:data-ending-style:translate-x-full lg:data-ending-style:translate-y-0 lg:data-starting-style:translate-x-full lg:data-starting-style:translate-y-0',
          )}
        >
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const DrawerClose = Dialog.Close;
