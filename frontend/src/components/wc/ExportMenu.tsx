'use client';

import { Menu } from '@base-ui/react/menu';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ExportFormat = 'xlsx' | 'csv' | 'pdf';

const FORMATS: { value: ExportFormat; tag: string; label: string; note: string }[] = [
  { value: 'xlsx', tag: 'XLS', label: 'Excel', note: 'Spreadsheet with every column' },
  { value: 'csv', tag: 'CSV', label: 'CSV', note: 'For other tools and imports' },
  { value: 'pdf', tag: 'PDF', label: 'PDF', note: 'Printable report' },
];

// Export button + menu (spec §7.2). The export itself runs on the server and
// covers every task matching the current tab, search and date range.
export function ExportMenu({
  onSelect,
  disabled,
  className,
}: {
  onSelect: (format: ExportFormat) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        disabled={disabled}
        className={cn(
          'inline-flex h-12 shrink-0 cursor-pointer items-center gap-2 rounded-full border-0 bg-ink px-5 font-ui text-[14.5px] font-semibold text-white outline-none hover:bg-black focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40',
          className,
        )}
      >
        <Download className="size-4" strokeWidth={2} aria-hidden="true" />
        Export
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50 outline-none">
          <Menu.Popup
            aria-label="Export tasks"
            className="flex w-[280px] origin-(--transform-origin) flex-col gap-1 rounded-[20px] bg-surface p-2.5 font-ui text-ink shadow-float outline-none transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0"
          >
            <p className="mx-2 mt-1 mb-2 text-[12.5px] leading-[1.45] text-ink-3">
              Exports every task matching your date range, tab and search — not just this page.
            </p>
            {FORMATS.map((f) => (
              <Menu.Item
                key={f.value}
                onClick={() => onSelect(f.value)}
                className="flex h-[46px] cursor-pointer items-center gap-2.5 rounded-[14px] px-3 text-left text-sm font-semibold outline-none data-highlighted:bg-surface-2"
              >
                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-stone text-[10.5px] font-bold">
                  {f.tag}
                </span>
                <span className="flex flex-1 flex-col">
                  <span>{f.label}</span>
                  <span className="text-xs font-medium text-ink-3">{f.note}</span>
                </span>
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
