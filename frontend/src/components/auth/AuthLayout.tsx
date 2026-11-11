'use client';

import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// Sign-in and password setup. No artboard exists for these, so they reuse
// the shell's pieces: the dark brand panel, Bricolage headings, stone inputs.

export function AuthLayout({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-stone font-ui text-ink">
      <aside className="hidden flex-[0_0_44%] flex-col justify-between bg-ink p-12 text-white lg:flex">
        <Brand />
        <div className="flex flex-col gap-5">
          <p className="m-0 font-display text-[64px] leading-[0.95] font-bold tracking-[-0.04em]">
            Plan it.
            <br />
            Track it.
            <br />
            <span className="text-yellow">Ship it.</span>
          </p>
          <p className="m-0 max-w-[380px] text-base leading-normal text-on-dark">Tasks, projects, people and clients for the WC Digital team, in one place.</p>
        </div>
        <span aria-hidden="true" className="flex gap-2.5">
          <span className="h-3 w-16 rounded-full bg-yellow" />
          <span className="h-3 w-10 rounded-full bg-dark-1" />
          <span className="h-3 w-6 rounded-full bg-dark-1" />
        </span>
      </aside>
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-[18px] py-12 lg:px-10">
        <div className="lg:hidden">
          <Brand dark />
        </div>
        <div className="flex w-full max-w-[440px] flex-col gap-6 rounded-[28px] bg-surface p-6 lg:rounded-[32px] lg:p-10">
          <div className="flex flex-col gap-2">
            <h1 className="m-0 font-display text-[34px] leading-none font-bold tracking-[-0.035em] lg:text-[44px]">{title}</h1>
            <p className="m-0 text-[15px] text-ink-2">{intro}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

function Brand({ dark }: { dark?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', dark ? 'text-ink' : 'text-white')}>
      {/* Stand-in mark, as in the sidebar, until the real logo files are supplied */}
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-yellow font-display text-[17px] font-extrabold tracking-[-0.05em] text-ink">wc</span>
      <span className="font-display text-[21px] font-bold tracking-[-0.02em]">wcdigital</span>
    </span>
  );
}

export const authInput =
  'h-[52px] w-full rounded-2xl border-0 bg-surface-2 px-[18px] font-ui text-[15px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink aria-invalid:ring-2 aria-invalid:ring-missed';
export const authButton =
  'h-[54px] w-full cursor-pointer rounded-full border-0 bg-ink font-ui text-base font-bold text-white outline-none hover:bg-black focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-50';

export function AuthField({ label, error, htmlFor, children }: { label: string; error?: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[13.5px] font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {error && <p className="m-0 text-[13px] font-semibold text-missed">{error}</p>}
    </div>
  );
}

/** Password input with a show / hide toggle; forwards react-hook-form's ref. */
export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function PasswordInput(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative flex">
      <input ref={ref} {...props} type={show ? 'text' : 'password'} className={cn(authInput, 'pr-12')} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink-3 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ink"
      >
        {show ? <EyeOff className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
      </button>
    </span>
  );
});
