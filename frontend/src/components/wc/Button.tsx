import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Pill buttons from the redesign. Sizes follow spec §3: 38/40 compact,
// 44–48 standard, 52 mobile primary.
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-0 font-ui font-semibold whitespace-nowrap cursor-pointer transition-[filter,background-color] outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-white hover:bg-black',
        accent: 'bg-yellow text-ink font-bold hover:brightness-95',
        secondary: 'bg-stone text-ink hover:brightness-[0.97]',
        white: 'bg-surface text-ink hover:bg-surface-2',
        ghost: 'bg-transparent text-ink-2 hover:text-ink',
        danger: 'bg-missed-tint text-missed hover:brightness-[0.97]',
        // Outline button on dark cards (e.g. Decline on the extension card)
        'dark-outline': 'border border-dark-line bg-transparent text-white hover:bg-dark-1',
      },
      size: {
        sm: 'h-[38px] px-3.5 text-[13px] [&_svg]:size-[11px]',
        md: 'h-10 px-4 text-sm [&_svg]:size-3.5',
        lg: 'h-12 px-[22px] text-[15px] [&_svg]:size-[18px]',
        xl: 'h-[52px] px-6 text-[15px] [&_svg]:size-[18px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'lg' },
  },
);

export type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

const iconButtonVariants = cva(
  'inline-flex size-10 shrink-0 items-center justify-center rounded-full border-0 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-35 [&_svg]:size-[15px]',
  {
    variants: {
      variant: {
        secondary: 'bg-stone text-ink hover:brightness-[0.97]',
        white: 'bg-surface text-ink hover:bg-surface-2',
        danger: 'bg-missed-tint text-missed hover:brightness-[0.97]',
        dark: 'bg-dark-2 text-white hover:bg-dark-line',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);

// Round 40px icon button (Edit / Delete on task rows, pagination arrows).
// `aria-label` is required because there is no visible text.
export function IconButton({
  className,
  variant,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof iconButtonVariants> & { 'aria-label': string }) {
  return <button type={type} className={cn(iconButtonVariants({ variant }), className)} {...props} />;
}
