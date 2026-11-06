import { cn } from '@/lib/utils';

// http(s):// or www. up to whitespace; trailing punctuation is trimmed below.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const TRAILING = /[.,;:!?'"\]}]+$/;

/** Drop sentence punctuation after a URL, keeping ")" only when it closes a "(" inside it. */
function trimUrl(url: string) {
  for (;;) {
    const next = url.replace(TRAILING, '');
    if (next.endsWith(')') && (next.match(/\(/g)?.length ?? 0) < (next.match(/\)/g)?.length ?? 0)) {
      url = next.slice(0, -1);
      continue;
    }
    return next;
  }
}

/** Renders plain text with any URLs turned into links that open in a new tab. */
export function Linkify({ text, className }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const url = trimUrl(m[0]);
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <a
        key={start}
        href={/^https?:\/\//i.test(url) ? url : `https://${url}`}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('break-all font-semibold underline underline-offset-2 hover:opacity-80', className)}
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
