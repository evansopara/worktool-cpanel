'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, FolderKanban, CheckSquare, MessageSquare, Mail,
  Bell, Calendar, FileText, Users, BookOpen, AlertCircle,
  HelpCircle, Star, Link2, StickyNote, Settings, Clock,
  LogOut, ChevronDown, Shield, BarChart3,
} from 'lucide-react';
import { useState, useEffect } from 'react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  children?: NavItem[];
  /** Key used to place this item in ROLE_MENU_ORDER when it differs from the label
   *  (e.g. the Technical Support/Management item whose displayed label changes per user). */
  sortKey?: string;
}

// Items without a `roles` restriction remain visible to every role, including
// 'client' — that role isn't covered by the per-role lists below, so its
// existing (unrestricted) sidebar is left untouched.
const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
  {
    label: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare,
    roles: ['operations_manager', 'team_lead', 'project_manager', 'staff', 'intern', 'client', 'customer_support_officer'],
  },
  {
    label: 'Messages', href: '/dashboard/messages', icon: MessageSquare,
    children: [
      { label: 'General Channel', href: '/dashboard/messages/general', icon: MessageSquare },
      { label: 'Direct Messages', href: '/dashboard/messages', icon: MessageSquare },
    ],
  },

  // Deadline extension requests — reviewer view (ops manager / team lead / CSO see everything, PM sees requests for their own projects)
  {
    label: 'Deadline Extension Requests', href: '/dashboard/extension-requests', icon: Clock,
    roles: ['operations_manager', 'team_lead', 'project_manager', 'customer_support_officer'],
  },
  // Deadline extension requests — requester's own view (staff / intern only; CSO reviews instead, like the roles above)
  {
    label: 'Extension Requests', href: '/dashboard/extension-requests', icon: Clock,
    roles: ['staff', 'intern'],
  },

  { label: 'Memos', href: '/dashboard/memos', icon: Mail, roles: ['operations_manager', 'team_lead', 'project_manager', 'staff', 'intern', 'client'] },
  { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, roles: ['client'] },

  // Review links — team lead reviews work sent to them; PM sends work for review
  { label: 'Assigned Reviews', href: '/dashboard/review-links', icon: Link2, roles: ['team_lead'] },
  { label: 'Send for Review', href: '/dashboard/review-links', icon: Link2, roles: ['project_manager'] },
  { label: 'Review Links', href: '/dashboard/review-links', icon: Link2, roles: ['client'] },

  { label: 'Bookings', href: '/dashboard/bookings', icon: Calendar, roles: ['operations_manager', 'team_lead', 'project_manager', 'customer_support_officer', 'client'] },
  { label: 'Resources', href: '/dashboard/resources', icon: FileText, roles: ['client'] },

  // Leave — managers review team leave; individual contributors apply for their own
  { label: 'Leave Management', href: '/dashboard/leave', icon: Calendar, roles: ['operations_manager', 'team_lead'] },
  { label: 'Leave Application', href: '/dashboard/leave', icon: Calendar, roles: ['project_manager', 'staff', 'intern', 'customer_support_officer', 'client'] },

  // Technical support — label flips to "Technical Management" for staff whose
  // specialization is technical_support; static per-role otherwise.
  { label: 'Technical Management', href: '/dashboard/support', icon: HelpCircle, roles: ['team_lead', 'project_manager', 'customer_support_officer'] },
  { label: 'Technical Support', href: '/dashboard/support', icon: HelpCircle, roles: ['staff', 'intern', 'client'], sortKey: 'Technical Support' },

  // Complaints (client complaints) — only team lead/ops manager review; only clients submit
  { label: 'Client Complaints', href: '/dashboard/complaints', icon: AlertCircle, roles: ['operations_manager', 'team_lead'] },
  { label: 'Complaints', href: '/dashboard/complaints', icon: AlertCircle, roles: ['client'] },

  // Staff complaints — team lead/ops manager review; everyone else (non-client, non-manager) submits
  { label: 'Staff Complaints', href: '/dashboard/staff-complaints', icon: AlertCircle, roles: ['operations_manager', 'team_lead'] },
  {
    label: 'Send Complaint', href: '/dashboard/staff-complaints', icon: AlertCircle,
    roles: ['project_manager', 'staff', 'intern', 'customer_support_officer'],
  },

  // Staff queries — managers issue/review; individual contributors see what they've received.
  // Clients never see this — queries are an internal disciplinary tool.
  { label: 'Staff Queries', href: '/dashboard/queries', icon: HelpCircle, roles: ['operations_manager', 'team_lead'] },
  { label: 'Staff Queries / Penalty', href: '/dashboard/queries', icon: HelpCircle, roles: ['project_manager'] },
  { label: 'Received Penalties', href: '/dashboard/queries', icon: HelpCircle, roles: ['staff', 'intern', 'customer_support_officer'] },

  { label: 'SOP', href: '/dashboard/sops', icon: BookOpen, roles: ['operations_manager', 'client'] },
  { label: 'Issue Reports', href: '/dashboard/issues', icon: AlertCircle, roles: ['client'] },
  // Client sentiment — only team lead/ops manager review the tracker; only clients submit
  { label: 'Client Sentiment', href: '/dashboard/sentiment', icon: Star, roles: ['operations_manager', 'team_lead'] },
  { label: 'Client Sentiment', href: '/dashboard/sentiment', icon: Star, roles: ['client'], sortKey: 'Client Sentiment (client)' },
  { label: 'Notes', href: '/dashboard/notes', icon: StickyNote, roles: ['operations_manager', 'client'] },

  // "Report App" — everyone (except clients, who see it as "Issue Reports" above)
  // can submit issues/suggestions here. Label flips to "App Issue/Error Management"
  // for staff whose specialization is technical_support — they see the review console instead.
  {
    label: 'Report App', href: '/dashboard/issues', icon: AlertCircle,
    roles: ['operations_manager', 'team_lead', 'project_manager', 'staff', 'intern', 'customer_support_officer'],
    sortKey: 'Report App',
  },

  { label: 'KPI Report', href: '/dashboard/kpi-report', icon: BarChart3, roles: ['operations_manager', 'team_lead'] },
  { label: 'Team', href: '/dashboard/team', icon: Users, roles: ['operations_manager', 'team_lead'] },
  { label: 'Admin', href: '/dashboard/admin', icon: Shield, roles: ['operations_manager', 'team_lead'] },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

// Exact sidebar order per role, using each item's `sortKey` (falling back to
// its label) — see the per-role spec this was built from.
const ROLE_MENU_ORDER: Record<string, string[]> = {
  operations_manager: [
    'Dashboard', 'Projects', 'Tasks', 'Deadline Extension Requests', 'Messages', 'Memos',
    'Bookings', 'Leave Management', 'Staff Queries', 'Staff Complaints', 'Client Sentiment',
    'Client Complaints', 'Notes', 'SOP', 'Technical Management', 'Report App', 'KPI Report', 'Estimate Drift', 'Team', 'Admin', 'Settings',
  ],
  team_lead: [
    'Dashboard', 'Projects', 'Tasks', 'Messages', 'Memos', 'Assigned Reviews', 'Technical Management',
    'Bookings', 'Leave Management', 'Deadline Extension Requests', 'Staff Queries', 'Client Complaints',
    'Staff Complaints', 'Client Sentiment', 'Report App', 'KPI Report', 'Estimate Drift', 'Team', 'Admin', 'Settings',
  ],
  project_manager: [
    'Dashboard', 'Projects', 'Tasks', 'Messages', 'Memos', 'Bookings', 'Leave Application',
    'Send for Review', 'Technical Management', 'Report App', 'Deadline Extension Requests', 'Send Complaint',
    'Staff Queries / Penalty', 'Settings',
  ],
  staff: [
    'Dashboard', 'Projects', 'Tasks', 'Messages', 'Leave Application', 'Send Complaint',
    'Received Penalties', 'Technical Support', 'Report App', 'Extension Requests', 'Memos', 'Settings',
  ],
  intern: [
    'Dashboard', 'Projects', 'Tasks', 'Messages', 'Leave Application', 'Send Complaint',
    'Received Penalties', 'Technical Support', 'Report App', 'Extension Requests', 'Memos', 'Settings',
  ],
  customer_support_officer: [
    'Dashboard', 'Projects', 'Tasks', 'Messages', 'Leave Application', 'Technical Management',
    'Deadline Extension Requests', 'Bookings', 'Received Penalties', 'Send Complaint',
    'Report App', 'Settings',
  ],
};

const DESKTOP_BREAKPOINT = 1024;

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const role = user?.role;
  const order = role ? ROLE_MENU_ORDER[role] : undefined;

  let filteredItems = navItems.filter((item) => !item.roles || (!!role && item.roles.includes(role)));

  // Staff whose specialization is technical_support see "Technical Management"
  // instead of "Technical Support", per the same /dashboard/support page.
  if (role === 'staff' && user?.specialization === 'technical_support') {
    filteredItems = filteredItems.map((item) => {
      if (item.sortKey === 'Technical Support') return { ...item, label: 'Technical Management' };
      if (item.sortKey === 'Report App') return { ...item, label: 'App Issue/Error Management' };
      return item;
    });
  }

  if (order) {
    filteredItems = [...filteredItems].sort((a, b) => {
      const ai = order.indexOf(a.sortKey ?? a.label);
      const bi = order.indexOf(b.sortKey ?? b.label);
      return (ai === -1 ? order.length : ai) - (bi === -1 ? order.length : bi);
    });
  }

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  const toggleCollapse = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const renderNavContent = (onNavClick?: () => void) => (
    <>
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border shrink-0">
        {/* White tile keeps the logo's purple "DIGITAL AGENCY" text visible on the purple sidebar */}
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, no image optimisation */}
        <img src="/favicon.ico" alt="WC Digital logo" className="w-8 h-8 rounded-md bg-white p-0.5 object-contain" />
        <span className="font-bold text-lg tracking-tight">wcdigital</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          if (item.children) {
            const open = !collapsed[item.label];
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleCollapse(item.label)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'hover:bg-sidebar-accent/60 text-sidebar-foreground/80'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
                </button>
                {open && (
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onNavClick}
                        className={cn(
                          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                          pathname === child.href
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                            : 'hover:bg-sidebar-accent/60 text-sidebar-foreground/70'
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent/60 text-sidebar-foreground/80'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-1 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-sidebar-primary flex items-center justify-center text-xs font-bold text-sidebar-primary-foreground shrink-0">
            {(user?.first_name?.[0] ?? '') + (user?.last_name?.[0] ?? '')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize truncate">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent/60 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </>
  );

  // Desktop: permanent sidebar in the flex layout
  if (isDesktop) {
    return (
      <aside className="flex flex-col w-64 h-screen bg-sidebar text-sidebar-foreground shrink-0">
        {renderNavContent()}
      </aside>
    );
  }

  // Mobile / tablet: slide-in drawer with backdrop
  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          display: isOpen ? 'block' : 'none',
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
      />

      {/* Drawer panel */}
      <aside
        aria-label="Navigation"
        className="bg-sidebar text-sidebar-foreground"
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 50,
          width: '18rem',
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 300ms ease-in-out',
        }}
      >
        {renderNavContent(onClose)}
      </aside>
    </>
  );
}
