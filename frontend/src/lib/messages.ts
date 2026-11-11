// Chat message text: replies and forwards are stored as plain text, in the
// format the old app already used for replies, so no database change is
// needed and old messages show the same way.
//
//   > Replying to Ada Obi:
//   > The quoted text
//
//   The reply
//
// A forwarded message starts with the FORWARDED line.

export const FORWARDED = '↪ Forwarded';
const REPLY_HEADER = /^> Replying to (.+):$/;

/** Older messages were saved with "\n" written out; show real line breaks. */
export function normalizeText(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\\r\\n|\\n/g, '\n');
}

export type ParsedMessage = { forwarded: boolean; reply: { name: string; text: string } | null; body: string };

export function parseMessage(content: string): ParsedMessage {
  let text = normalizeText(content);
  const forwarded = text.startsWith(FORWARDED + '\n') || text === FORWARDED;
  if (forwarded) text = text.slice(FORWARDED.length).replace(/^\n/, '');

  const lines = text.split('\n');
  const header = REPLY_HEADER.exec(lines[0] ?? '');
  if (!header) return { forwarded, reply: null, body: text };

  let i = 1;
  const quoted: string[] = [];
  while (i < lines.length && lines[i].startsWith('>')) {
    quoted.push(lines[i].replace(/^> ?/, ''));
    i++;
  }
  while (i < lines.length && lines[i].trim() === '') i++;
  // A reply to a reply quotes the whole earlier reply; show only its own text.
  const inner = parseMessage(quoted.join('\n'));
  return { forwarded, reply: { name: header[1], text: inner.body.trim() }, body: lines.slice(i).join('\n') };
}

/** The stored text for a reply: a short quote of the original, then the reply. */
export function replyContent(name: string, original: string, reply: string): string {
  const quote = parseMessage(original).body.trim().split('\n').slice(0, 3);
  return [`> Replying to ${name}:`, ...quote.map((l) => `> ${l}`), '', reply].join('\n');
}

/** The stored text for a forward: the original's own text, marked as forwarded. */
export function forwardContent(original: string): string {
  return `${FORWARDED}\n${parseMessage(original).body.trim()}`;
}

/** Plain text for Copy and for previews. */
export function plainText(content: string): string {
  return parseMessage(content).body.trim();
}
