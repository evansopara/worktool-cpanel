import type { User, UserRole } from '@/types';

// Navigation for the redesigned shell (design/HANDOFF_SPEC.md §4).
//
// The spec's menus group the old pages into hub sections (People = leave,
// team, queries, staff complaints, ...). Until each hub page is rebuilt, a
// section links to its first page the user can open, and SectionTabs shows
// the section's other pages. Who can open which page is copied from the old
// sidebar, so no role gains or loses access with the new menu.

export type SectionKey =
  | 'home'
  | 'projects'
  | 'tasks'
  | 'inbox'
  | 'calendar'
  | 'people'
  | 'clients'
  | 'insights'
  | 'library'
  | 'admin'
  | 'settings'
  | 'requests'
  | 'penalties'
  | 'support';

type Role = Exclude<UserRole, 'client'>;

const MANAGERS: Role[] = ['operations_manager', 'team_lead', 'project_manager'];
const ALL: Role[] = [...MANAGERS, 'staff', 'intern', 'customer_support_officer'];

export type SubPage = { href: string; label: string };

type PageDef = {
  href: string;
  roles: Role[];
  label: string | ((user: User) => string);
};

const isTechSupportStaff = (u: User) => u.role === 'staff' && u.specialization === 'technical_support';

// Every old page the shell links to, with the roles that see it in the old
// sidebar and its tab label.
const PAGES = {
  home: { href: '/dashboard', roles: ALL, label: 'Home' },
  projects: { href: '/dashboard/projects', roles: ALL, label: 'Projects' },
  tasks: { href: '/dashboard/tasks', roles: ALL, label: 'Tasks' },
  extensions: { href: '/dashboard/extension-requests', roles: ALL, label: 'Extension requests' },
  messages: { href: '/dashboard/messages', roles: ALL, label: 'Direct messages' },
  general: { href: '/dashboard/messages/general', roles: ALL, label: 'General channel' },
  memos: { href: '/dashboard/memos', roles: [...MANAGERS, 'staff', 'intern'], label: 'Memos' },
  bookings: { href: '/dashboard/bookings', roles: [...MANAGERS, 'customer_support_officer'], label: 'Bookings' },
  leave: {
    href: '/dashboard/leave',
    roles: ALL,
    label: (u) => (u.role === 'operations_manager' || u.role === 'team_lead' ? 'Leave' : 'Leave application'),
  },
  team: { href: '/dashboard/team', roles: ['operations_manager', 'team_lead'], label: 'Team' },
  queries: {
    href: '/dashboard/queries',
    roles: ALL,
    label: (u) =>
      u.role === 'operations_manager' || u.role === 'team_lead'
        ? 'Queries'
        : u.role === 'project_manager'
          ? 'Queries / penalty'
          : 'Received penalties',
  },
  staffComplaints: {
    href: '/dashboard/staff-complaints',
    roles: ALL,
    label: (u) => (u.role === 'operations_manager' || u.role === 'team_lead' ? 'Staff complaints' : 'Send complaint'),
  },
  sentiment: { href: '/dashboard/sentiment', roles: ['operations_manager', 'team_lead'], label: 'Sentiment' },
  clientComplaints: { href: '/dashboard/complaints', roles: ['operations_manager', 'team_lead'], label: 'Complaints' },
  reviewLinks: {
    href: '/dashboard/review-links',
    roles: ['team_lead', 'project_manager'],
    label: (u) => (u.role === 'team_lead' ? 'Assigned reviews' : 'Send for review'),
  },
  kpi: { href: '/dashboard/kpi-report', roles: ['operations_manager', 'team_lead'], label: 'KPI report' },
  sops: { href: '/dashboard/sops', roles: ['operations_manager'], label: 'SOPs' },
  notes: { href: '/dashboard/notes', roles: ['operations_manager'], label: 'Notes' },
  admin: { href: '/dashboard/admin', roles: ['operations_manager', 'team_lead'], label: 'Users' },
  settings: { href: '/dashboard/settings', roles: ALL, label: 'Settings' },
  issues: {
    href: '/dashboard/issues',
    roles: ALL,
    label: (u) => (isTechSupportStaff(u) ? 'App issue management' : 'Report an issue'),
  },
  support: {
    href: '/dashboard/support',
    roles: ['team_lead', 'project_manager', 'staff', 'intern', 'customer_support_officer'],
    label: (u) => (u.role === 'staff' || u.role === 'intern') && !isTechSupportStaff(u) ? 'Technical support' : 'Technical management',
  },
} satisfies Record<string, PageDef>;

type SectionDef = {
  key: SectionKey;
  label: string | ((user: User) => string);
  /** One line under the label on the mobile More tiles */
  sub: string;
  pages: PageDef[];
  /**
   * A rebuilt hub page shown instead of the old pages it covers, for the
   * roles that can open it. `hubCovers` lists those pages (default: all).
   */
  hub?: PageDef;
  hubCovers?: PageDef[];
};

// Rebuilt hub pages (spec §9 step 6).
const HUBS = {
  people: { href: '/dashboard/people', roles: ['operations_manager', 'team_lead'], label: 'People' },
  inbox: { href: '/dashboard/messages', roles: ALL, label: 'Inbox' },
  clients: { href: '/dashboard/clients', roles: ['operations_manager', 'team_lead'], label: 'Clients' },
  library: { href: '/dashboard/library', roles: ['operations_manager'], label: 'Library' },
} satisfies Record<string, PageDef>;

const S = {
  home: { key: 'home', label: 'Home', sub: '', pages: [PAGES.home] },
  projects: { key: 'projects', label: 'Projects', sub: '', pages: [PAGES.projects] },
  tasks: { key: 'tasks', label: 'Tasks', sub: '', pages: [PAGES.tasks] },
  myTasks: { key: 'tasks', label: 'My tasks', sub: '', pages: [PAGES.tasks] },
  inbox: { key: 'inbox', label: 'Inbox', sub: '', pages: [PAGES.messages, PAGES.general, PAGES.memos], hub: HUBS.inbox },
  calendar: { key: 'calendar', label: 'Calendar', sub: 'Meetings and bookings', pages: [PAGES.bookings] },
  people: {
    key: 'people',
    label: 'People',
    sub: 'Team, leave, queries, complaints',
    pages: [PAGES.leave, PAGES.team, PAGES.queries, PAGES.staffComplaints],
    hub: HUBS.people,
  },
  clients: {
    key: 'clients',
    label: 'Clients',
    sub: 'Sentiment and complaints',
    pages: [PAGES.sentiment, PAGES.clientComplaints, PAGES.reviewLinks],
    // Review links aren't in the design; Team Leads keep that page as a tab.
    hub: HUBS.clients,
    hubCovers: [PAGES.sentiment, PAGES.clientComplaints],
  },
  insights: { key: 'insights', label: 'Insights', sub: 'KPI report', pages: [PAGES.kpi] },
  library: { key: 'library', label: 'Library', sub: 'SOPs and notes', pages: [PAGES.sops, PAGES.notes], hub: HUBS.library },
  admin: { key: 'admin', label: 'Admin', sub: 'Users and access', pages: [PAGES.admin] },
  settings: { key: 'settings', label: 'Settings', sub: 'Profile, password, appearance', pages: [PAGES.settings, PAGES.issues, PAGES.support] },
  staffSettings: { key: 'settings', label: 'Settings', sub: 'Profile, password, appearance', pages: [PAGES.settings, PAGES.issues] },
  requests: {
    key: 'requests',
    label: 'Leave and complaints',
    sub: 'Apply for leave, send a complaint',
    pages: [PAGES.leave, PAGES.staffComplaints],
  },
  penalties: { key: 'penalties', label: 'Received penalties', sub: 'Queries and penalties', pages: [PAGES.queries] },
  support: {
    key: 'support',
    label: (u) => (isTechSupportStaff(u) ? 'Technical management' : 'Technical support'),
    sub: 'Get help with tools and access',
    pages: [PAGES.support],
  },
} satisfies Record<string, SectionDef>;

// Menus by role (spec §4). Customer Support Officers count as managers (decided
// 2026-10-27), but still only see the pages they could open before.
const MANAGER_MENU: { label: string; sections: SectionDef[] }[] = [
  { label: '', sections: [S.home, S.projects, S.tasks, S.inbox, S.calendar] },
  { label: 'Team and clients', sections: [S.people, S.clients, S.insights, S.library] },
  { label: 'System', sections: [S.admin, S.settings] },
];

const STAFF_MENU: { label: string; sections: SectionDef[] }[] = [
  { label: '', sections: [S.home, S.projects, S.myTasks, S.inbox, S.calendar] },
  { label: 'Requests', sections: [S.requests, S.penalties, S.support] },
  { label: 'Account', sections: [S.staffSettings] },
];

export type NavSection = {
  key: SectionKey;
  label: string;
  sub: string;
  href: string;
  pages: SubPage[];
};

export type NavGroup = { label: string; sections: NavSection[] };

// Roles that get the manager menu. Wider than MANAGERS, which only lists the
// roles the old sidebar gave manager pages to.
const MANAGER_MENU_ROLES: Role[] = [...MANAGERS, 'customer_support_officer'];

export function isManager(user: User) {
  return (MANAGER_MENU_ROLES as string[]).includes(user.role);
}

export function buildNav(user: User): NavGroup[] {
  const menu = isManager(user) ? MANAGER_MENU : STAFF_MENU;
  const role = user.role as Role;
  return menu
    .map((g) => ({
      label: g.label,
      sections: g.sections
        .map((s): NavSection | null => {
          const covered = s.hubCovers ?? s.pages;
          const defs = s.hub && s.hub.roles.includes(role) ? [s.hub, ...s.pages.filter((p) => !covered.includes(p))] : s.pages;
          const pages = defs
            .filter((p) => p.roles.includes(role))
            .map((p) => ({ href: p.href, label: typeof p.label === 'function' ? p.label(user) : p.label }));
          if (pages.length === 0) return null;
          return {
            key: s.key,
            label: typeof s.label === 'function' ? s.label(user) : s.label,
            sub: s.sub,
            href: pages[0].href,
            pages,
          };
        })
        .filter((s): s is NavSection => s !== null),
    }))
    .filter((g) => g.sections.length > 0);
}

function matches(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(href + '/');
}

// The section and page the current path belongs to. The longest matching page
// wins, so /dashboard/messages/general is not read as /dashboard/messages.
export function findActive(groups: NavGroup[], pathname: string): { section: NavSection; page: SubPage } | null {
  let best: { section: NavSection; page: SubPage } | null = null;
  for (const g of groups)
    for (const section of g.sections)
      for (const page of section.pages)
        if (matches(pathname, page.href) && (!best || page.href.length > best.page.href.length)) best = { section, page };
  return best;
}

export function roleLabel(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Sections in the mobile dock; everything else is on the More screen.
export const DOCK_SECTIONS: SectionKey[] = ['home', 'projects', 'tasks', 'inbox'];

// Tile order on the More screen (MMore artboard); the first tile is dark.
export const MORE_ORDER: SectionKey[] = [
  'people',
  'requests',
  'clients',
  'penalties',
  'support',
  'calendar',
  'insights',
  'library',
  'admin',
  'settings',
];
