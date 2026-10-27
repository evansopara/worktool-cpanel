import { memosApi, messagesApi } from '@/lib/api';
import type { ChatMessage } from '@/lib/projects';

// Inbox (Inbox / MInbox / MChat artboards): chats and memos.

export type Preview = { content: string; sender: string | null; mine: boolean; at: string } | null;

/** GET /messages/inbox */
export type InboxData = {
  general: { last: Preview };
  projects: { id: number; name: string; last: Preview }[];
  direct: { user_id: number; last: Preview; unread: number }[];
};

/** A conversation key in the URL: "general", "p12" (project) or "u5" (person). */
export type ConvKey = 'general' | `p${number}` | `u${number}`;

export function parseConv(v: string | null): ConvKey | null {
  if (v === 'general') return v;
  if (v && /^[pu]\d+$/.test(v)) return v as ConvKey;
  return null;
}

export const inboxApi = {
  summary: () => messagesApi.inbox().then((r) => r.data as InboxData),
  messages: (c: ConvKey): Promise<ChatMessage[]> => {
    if (c === 'general') return messagesApi.generalMessages().then((r) => r.data);
    const id = Number(c.slice(1));
    return (c[0] === 'p' ? messagesApi.projectMessages(id) : messagesApi.directMessages(id)).then((r) => r.data);
  },
  send: (c: ConvKey, content: string) => {
    if (c === 'general') return messagesApi.sendGeneral(content);
    const id = Number(c.slice(1));
    return c[0] === 'p' ? messagesApi.sendProjectMessage(id, content) : messagesApi.sendDirect(id, content);
  },
};

export type Memo = {
  id: number;
  subject: string;
  content: string;
  type: 'individual' | 'general' | 'department';
  department?: string | null;
  recipients: number[];
  sender_id: number;
  sender?: { id: number; first_name: string; last_name: string };
  reads?: { user_id: number; read_at: string }[];
  responses?: { id: number; content: string; created_at: string; user?: { id: number; first_name: string; last_name: string } }[];
  created_at: string;
};

export const memoApi = {
  list: () => memosApi.list().then((r) => r.data as Memo[]),
  get: (id: number) => memosApi.get(id).then((r) => r.data as Memo),
  create: (data: Record<string, unknown>) => memosApi.create(data),
  remove: (id: number) => memosApi.remove(id),
  respond: (id: number, content: string) => memosApi.respond(id, content),
};

/** Roles that can write memos (old Memos page). */
export const MEMO_COMPOSERS = ['operations_manager', 'team_lead', 'project_manager'];

export const MEMO_TYPES: Record<Memo['type'], { label: string; tile: string }> = {
  individual: { label: 'Individual', tile: 'bg-pending-tint text-pending' },
  department: { label: 'Department', tile: 'bg-review-tint text-review' },
  general: { label: 'Broadcast', tile: 'bg-ink text-yellow' },
};
