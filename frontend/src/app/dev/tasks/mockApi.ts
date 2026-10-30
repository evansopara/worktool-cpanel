import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

// Sample API for /dev/tasks: answers the task endpoints in memory so the real
// task screens (and their start-early / read-first prompts) can be checked
// without logging in. Names and projects come from the design artboards.

type MockTask = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  project: { id: number; name: string };
  assignee: { id: number; first_name: string; last_name: string };
  assigner: { id: number; first_name: string; last_name: string };
  start: number; // minutes from now
  due: number;
  estimate: number;
  logged: number;
  running: boolean;
  read: boolean;
  lock: boolean;
  pendingExt: boolean;
};

const MIN = 60_000;
const people = {
  ige: { id: 1, first_name: 'Olubukola', last_name: 'Ige' },
  titi: { id: 2, first_name: 'Adeyemo', last_name: 'Titilope' },
  victor: { id: 10, first_name: 'Victor', last_name: 'Adeleye' },
  ashe: { id: 11, first_name: 'Asheoluwa', last_name: 'Oke' },
  jamiu: { id: 12, first_name: 'Jamiu', last_name: 'Ikhlas' },
  emma: { id: 13, first_name: 'Emmanuel', last_name: 'Evans' },
};
const projects = [
  { id: 1, name: 'WC Digital Agency' },
  { id: 2, name: 'Contour Fajaas Africa' },
  { id: 3, name: 'Marketing Team' },
  { id: 4, name: 'Abiola Adediran' },
  { id: 5, name: 'TopMart' },
];

function seed(): MockTask[] {
  const t = (o: Partial<MockTask> & Pick<MockTask, 'id' | 'title'>): MockTask => ({
    description: null,
    status: 'todo',
    project: projects[0],
    assignee: people.victor,
    assigner: people.titi,
    start: 60,
    due: 240,
    estimate: 120,
    logged: 0,
    running: false,
    read: true,
    lock: false,
    pendingExt: false,
    ...o,
  });
  const list = [
    t({ id: 1, title: '[Website task title]', status: 'todo', start: 151, due: 330, estimate: 179, read: false,
      description: 'Build the new homepage hero from the Figma file.\n\n1. Use the brand fonts.\n2. Link the CTA to /contact.\n3. Done = merged and checked on mobile.' }),
    t({ id: 2, title: 'Logo files for TopMart', status: 'in_progress', project: projects[4], start: -30, due: 90, estimate: 120, logged: 2400 }),
    t({ id: 3, title: 'Work on Contourfajasafrica email', status: 'deadline_missed', project: projects[1], start: -4440, due: -4320, pendingExt: true }),
    t({ id: 4, title: 'Opt-in copy, headlines and Cart Abandonment for Money Game Wealth Launchpad Course', status: 'deadline_missed',
      project: projects[3], assignee: people.ashe, start: -4500, due: -4320, estimate: 180, description: 'Write the opt-in page copy and three abandonment emails.' }),
    t({ id: 5, title: 'Get Ad creatives that is ready', status: 'review', project: projects[2], assignee: people.jamiu, start: -7000, due: -6980, estimate: 20, logged: 900 }),
    t({ id: 6, title: 'Monthly report', status: 'completed', start: -9000, due: -8800, logged: 6400 }),
  ];
  const titles = ['Homepage hero section', 'SMTP setup and test emails', 'Product page layout', 'Checkout flow review', 'Mobile menu fixes', 'Client walkthrough prep',
    'Blog page template', 'Contact form validation', 'Speed optimisation pass', 'Footer and legal pages', 'Image compression', 'Landing page copy edits',
    'Payment gateway test', 'Banner resize for ads', 'Newsletter template', 'About page update', '404 page design', 'Analytics setup', 'Search results page'];
  const who = [people.emma, people.victor, people.ashe, people.jamiu];
  const statuses = ['in_progress', 'todo', 'review', 'on_hold'];
  titles.forEach((title, i) =>
    list.push(t({ id: 100 + i, title, project: projects[i % projects.length], assignee: who[i % 4], assigner: people.ige, status: statuses[i % 4],
      start: 600 + i * 60, due: 720 + i * 60, estimate: 60 + (i % 3) * 60, logged: statuses[i % 4] === 'todo' ? 0 : 1800 + i * 120 })),
  );
  return list;
}

let tasks = seed();
let plan = 5; // deliverables done in the sample project plan
const chat = [
  { id: 1, content: 'Can we start with the SMTP for this site? https://queenbodysecret.com/', sender_id: 2, sender: { id: 2, first_name: 'Sandra', last_name: 'Mike' }, created_at: new Date(Date.now() - 4 * 3600_000).toISOString() },
  { id: 2, content: 'Good morning, What do you want to achieve?', sender_id: 13, sender: { id: 13, first_name: 'Shittu', last_name: 'Mubaraq' }, created_at: new Date(Date.now() - 3 * 3600_000).toISOString() },
  { id: 3, content: 'What is the update?', sender_id: 2, sender: { id: 2, first_name: 'Sandra', last_name: 'Mike' }, created_at: new Date(Date.now() - 2 * 3600_000).toISOString() },
];

const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
const leave = [
  { id: 1, user: { id: 20, first_name: 'Linda', last_name: 'Ekeh', email: 'linda.ekeh22@gmail.com' }, leave_type: 'annual', start_date: ago(-36), end_date: ago(-37), total_days: 1, reason: 'Dear BI, I would like to take a day off for a family event.', status: 'pending', created_at: ago(2) },
  { id: 2, user: { id: 21, first_name: 'Temitayo', last_name: 'Akintunde', email: 'akinstemi123@gmail.com' }, leave_type: 'annual', start_date: ago(-28), end_date: ago(-32), total_days: 5, reason: 'Travelling home.', status: 'pending', created_at: ago(4) },
  { id: 3, user: { id: 22, first_name: 'Mirakl', last_name: '', email: 'somchimiracle@gmail.com' }, leave_type: 'leave_of_absence', start_date: ago(200), end_date: ago(194), total_days: 5, reason: 'My presence is needed at home.', status: 'approved', created_at: ago(215) },
  { id: 4, user: { id: 1, first_name: 'Olubukola', last_name: 'Ige', email: 'bukkieige@gmail.com' }, leave_type: 'day_off', start_date: ago(340), end_date: ago(340), total_days: 1, reason: 'I have a pre-existing appointment.', status: 'approved', created_at: ago(345) },
];
const queries = [
  { id: 3, subject: 'Missed stand-up', message: 'You missed Monday and Tuesday stand-ups without notice.', status: 'pending', response: null, assigned_to: 10, submitted_by: 1, submitter: people.ige, assignee: people.victor, created_at: ago(0.5) },
  { id: 1, assigned_to: 10, submitted_by: 1, subject: 'Late submissions', message: 'Three tasks were submitted after the deadline this week.', status: 'acknowledged', response: 'Noted, it won’t happen again.', submitter: people.ige, assignee: people.victor, created_at: ago(90) },
  { id: 2, assigned_to: 11, submitted_by: 1, subject: 'Work app misuse', message: 'Timers were left running overnight.', status: 'pending', response: null, submitter: people.ige, assignee: people.ashe, created_at: ago(400) },
];
const staffComplaints = [
  { id: 7, name: 'Temitayo Matthew Akintunde', email: 'akinstemi123@gmail.com', department: 'Test', detailed_explanation: 'The office internet keeps dropping during client calls.', screenshot_url: null, status: 'pending', review_comments: null, created_at: ago(170) },
  ...[1, 2, 3].map((id) => ({ id, name: 'Linda Ekeh', email: 'linda.ekeh22@gmail.com', department: 'Design', detailed_explanation: 'Laptop charger replacement.', screenshot_url: null, status: 'resolved', review_comments: 'Replaced.', created_at: ago(300 - id) })),
];

type Msg = (typeof chat)[number];
const say = (id: number, from: { id: number; first_name: string; last_name: string }, content: string, minsAgo: number): Msg => ({ id, content, sender_id: from.id, sender: from, created_at: new Date(Date.now() - minsAgo * 60_000).toISOString() });
const threads: Record<string, Msg[]> = {
  general: [say(101, people.ashe, 'Good morning everyone', 900), say(102, people.jamiu, 'Noted', 880), say(103, people.ige, 'Team meeting at 10am, please join on time.', 600), say(104, people.emma, 'Acknowledged', 590)],
  u11: [say(201, people.ashe, 'Good morning', 300), say(202, people.ashe, 'I received a notification that I was assigned a task but nothing shows on my dashboard.', 299), say(203, people.ashe, 'Kindly ignore, I’ve gotten feedback.', 120)],
  u12: [say(301, people.jamiu, 'Creatives are ready for review', 2000)],
};
const memos = [
  { id: 1, subject: 'Warning', content: 'Please stop leaving timers running overnight.', type: 'individual', recipients: [11], sender_id: 1, sender: people.ige, reads: [], responses: [], created_at: ago(30) },
  { id: 2, subject: 'MISSED TASK DEADLINE', content: 'Several tasks missed their deadlines last week. Plan your day around your scheduled tasks.', type: 'general', recipients: [10, 11, 12, 13], sender_id: 1, sender: people.ige, reads: [{ user_id: 10, read_at: ago(1) }], responses: [{ id: 1, content: 'Noted, thank you.', created_at: ago(1), user: people.victor }], created_at: ago(70) },
  { id: 3, subject: 'Design team update', content: 'New brand files are in the shared drive.', type: 'department', department: 'Design', recipients: [11], sender_id: 2, sender: people.titi, reads: [], responses: [], created_at: ago(90) },
];

// Calendar and Library (step 6)
const at = (days: number, hour: number, min = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};
const meet = (id: number, title: string, type: string, days: number, hour: number, mins: number, by: { id: number; first_name: string; last_name: string }, participants: number[], link: string | null = null) => ({
  id, title, type, description: null, participants, start_time: at(days, hour), end_time: at(days, hour, mins), status: 'scheduled', meeting_link: link, scheduled_by: by.id, scheduler: by,
});
const bookings = [
  meet(1, 'Weekly team stand-up', 'general', 1, 10, 30, people.ige, [1, 2, 10, 11, 12, 13], 'https://meet.google.com/abc-defg-hij'),
  meet(2, 'TopMart launch review', 'team', 2, 14, 45, people.ige, [1, 10, 11]),
  meet(3, 'Marketing call: Q4 campaigns', 'marketing_meeting_call', 6, 11, 60, people.titi, [2, 11]),
  meet(4, 'One-on-one with Victor', 'one_on_one', -3, 15, 30, people.ige, [10]),
];
let sopSeq = 3;
const sops: { id: number; title: string; description: string | null; category: string | null; segments: { id: number; title: string; content: string; order_index: number }[] }[] = [
  { id: 1, title: 'Website delivery', category: 'Projects', description: 'From signed brief to launch, for every website project.', segments: [
    { id: 1, title: 'Kickoff', content: 'Hold the kickoff call within two working days and confirm the brief in writing.', order_index: 0 },
    { id: 2, title: 'Build and review', content: 'Share a staging link each Friday. Collect feedback in the project chat only.', order_index: 1 },
  ] },
  { id: 2, title: 'Client complaints', category: 'Clients', description: 'Acknowledge within an hour, resolve or escalate within a day.', segments: [] },
];
const issues = [{ id: 1, title: 'Not able to resolve staff issues', description: 'I need to have access to close off staff issues', status: 'closed', created_at: ago(40) }];
const notifications = [
  { id: 1, title: 'New Task Assigned', message: 'You have been assigned the task: "Logo files for TopMart"', type: 'task_assigned', read: false, reference_id: 2, reference_type: 'task', link: '/dashboard/tasks?task=2', created_at: ago(0.02) },
  { id: 2, title: 'Deadline Extension Approved', message: 'Your deadline extension for "Work on Contourfajasafrica email" was approved.', type: 'deadline_extension_decided', read: false, reference_id: 1, reference_type: 'deadline_extension_request', link: '/dashboard/tasks?view=ext', created_at: ago(0.3) },
  { id: 3, title: 'Task Completed', message: 'Your task "Monthly report" has been marked complete.', type: 'task_completed', read: true, reference_id: 4, reference_type: 'task', created_at: ago(2) },
];
const reviewLinks = [
  { id: 1, title: 'TopMart homepage v2', link_url: 'https://example.com/topmart', description: 'Updated hero, new product grid and footer links.', status: 'pending', sent_by: 2, assigned_to: 13, sender: people.titi, assignee: people.emma, review_comment: null, reviewed_at: null, created_at: ago(1) },
  { id: 2, title: 'Q4 ad creatives', link_url: 'https://example.com/ads', description: null, status: 'not_approved', sent_by: 2, assigned_to: 13, sender: people.titi, assignee: people.emma, review_comment: 'Logo is too small on the square formats.', reviewed_at: ago(0.5), created_at: ago(3) },
];
const support = [
  { id: 1, title: 'VPN keeps disconnecting', description: 'Drops every 10 minutes since Monday.', requester_id: 10, requester: people.victor, status: 'open', priority: 'high', created_at: ago(0.2) },
  { id: 2, title: 'Figma seat', description: 'Need edit access for the TopMart file.', requester_id: 10, requester: people.victor, status: 'resolved', priority: 'medium', resolution: 'Seat added to your account.', created_at: ago(4) },
];
let noteSeq = 4;
const notes = [
  { id: 1, title: 'Monday priorities', content: 'Chase TopMart content\nApprove Q4 ad budget\nInterview for design intern', color: 'bg-yellow-50 border-yellow-200', updated_at: ago(0.1) },
  { id: 2, title: 'Ideas for the retreat', content: 'Half-day workshop on estimates. Ask Titi about venues.', color: 'bg-blue-50 border-blue-200', updated_at: ago(3) },
  { id: 3, title: 'Client follow-ups', content: 'Send Delight the revised quote.', color: '', updated_at: ago(8) },
];

function sampleProjects() {
  const day = 86400000;
  const p = (id: number, name: string, category: string, status: string, progress: number, endDays: number, idleDays = 0) => ({
    id, name, category, status, progress, manager_id: 2,
    start_date: new Date(Date.now() - 30 * day).toISOString(), end_date: new Date(Date.now() + endDays * day).toISOString(),
    created_at: new Date(Date.now() - 40 * day).toISOString(), updated_at: new Date(Date.now() - idleDays * day).toISOString(),
  });
  return [
    p(1, 'WC Digital Agency', 'website_development', 'active', 60, 10),
    p(5, 'TopMart', 'website_development', 'active', 100, -5),
    p(20, 'QueenbodySecret', 'website_development', 'completed', 100, -20, 3),
    p(21, 'Oladoyin taiwo', 'website_development', 'completed', 100, -25, 20),
    p(22, 'Adan Idet', 'website_development', 'completed', 100, -30, 20),
    p(23, 'Royal Bakes', 'website_development', 'active', 35, -3, 12),
    p(12, 'Temitope Oyewole', 'dpl_outright', 'pending', 0, -8),
    p(13, 'Dr Gloria Esoimeme', 'dpl_outright', 'pending', 10, 12),
    p(2, 'Contour Fajaas Africa', 'dpl_outright', 'active', 40, -2, 11),
    p(11, 'SALAMAT', 'dpl_partnership', 'pending', 0, 20),
    p(3, 'Marketing Team', 'direct_marketing', 'active', 20, 40),
    p(4, 'Abiola Adediran', 'support_maintenance', 'active', 50, 15),
  ];
}
let runningSince: Record<number, number> = {};
const iso = (mins: number) => new Date(Date.now() + mins * MIN).toISOString();
const name = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`;
const logged = (t: MockTask) => t.logged + (t.running ? Math.floor((Date.now() - (runningSince[t.id] ?? Date.now())) / 1000) : 0);

function listItem(t: MockTask) {
  return {
    id: t.id, title: t.title, status: t.status, priority: 'medium', project: t.project,
    assignee: { id: t.assignee.id, name: name(t.assignee) }, assigned_by: { id: t.assigner.id, name: name(t.assigner) },
    start_date: iso(t.start), deadline: iso(t.due), estimate_minutes: t.estimate, logged_seconds: logged(t),
    is_timer_running: t.running, timer_start_time: null, has_instructions: !!t.description,
    instructions_preview: t.description ? t.description.replace(/\s+/g, ' ').slice(0, 160) : null, pending_extension: t.pendingExt, lock_early_start: t.lock,
  };
}

function detail(t: MockTask) {
  return {
    ...listItem(t), description: t.description, project_id: t.project.id, assignee_id: t.assignee.id, assignee: t.assignee, assigner: t.assigner,
    working_hours: Math.floor(t.estimate / 60), working_minutes: t.estimate % 60,
    pending_extension: t.pendingExt ? extensions().find((r) => r.task_id === t.id) ?? null : null,
  };
}

function extensions() {
  const t = tasks.find((x) => x.id === 3)!;
  return [
    ...(t.pendingExt
      ? [{ id: 1, task_id: 3, requester_id: 10, reason: 'Waiting on the client’s copy', requested_deadline: iso(60 * 20), approved_deadline: null, status: 'pending',
          decision_reason: null, created_at: iso(-60), task: { id: 3, title: t.title, deadline: iso(t.due), project: t.project }, requester: people.victor }]
      : []),
    { id: 2, task_id: 6, requester_id: 10, reason: 'More pages', requested_deadline: iso(-8700), approved_deadline: iso(-8700), status: 'approved',
      decision_reason: null, created_at: iso(-9000), task: { id: 6, title: 'Monthly report', deadline: iso(-8700), project: projects[0] }, requester: people.victor },
  ];
}

function events(t: MockTask) {
  const ev = (id: number, type: string, mins: number, actor: { id: number; name: string; role: string } | null, extra: object = {}) => ({
    id, type, actor, from: null, to: null, meta: null, created_at: iso(mins), ...extra,
  });
  const mgr = { id: t.assigner.id, name: name(t.assigner), role: 'project_manager' };
  const staff = { id: t.assignee.id, name: name(t.assignee), role: 'staff' };
  const list = [
    ev(1, 'created', t.start - 300, mgr, { to: { estimate_minutes: t.estimate, start_date: iso(t.start), deadline: iso(t.due - 8) } }),
    ev(2, 'field_edited', t.start - 120, mgr, { from: { value: iso(t.due - 8) }, to: { value: iso(t.due) }, meta: { field: 'deadline', reason: 'Client sent assets late' } }),
    ev(3, 'deadline_soon', t.due - 10, null, { meta: { minutes: 10 } }),
  ];
  if (t.id === 3) list.push(ev(4, 'deadline_missed', t.due, null, { meta: { cause: 'not_started' } }),
    ev(5, 'extension_requested', -60, staff, { from: { deadline: iso(t.due) }, to: { deadline: iso(60 * 20) }, meta: { reason: 'Waiting on the client’s copy' } }));
  if (t.logged > 0) list.push(ev(6, 'timer_started', t.start, staff), ev(7, 'timer_stopped', t.start + t.logged / 60, staff, { meta: { session_seconds: t.logged } }));
  list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    data: list,
    summary: {
      worked: { seconds: logged(t), sessions: t.logged > 0 ? 1 : 0 },
      start: t.logged > 0 ? { state: 'on_time', minutes: 0 } : { state: 'not_started', minutes: null },
      finish: { state: logged(t) / 60 > t.estimate ? 'over_estimate' : 'within_estimate', minutes: Math.abs(t.estimate - Math.floor(logged(t) / 60)),
        logged_minutes: Math.floor(logged(t) / 60), estimate_minutes: t.estimate },
      changes: { edits: 1, extension: t.pendingExt ? 'pending' : null },
    },
  };
}

function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

function fail(config: InternalAxiosRequestConfig, status: number, data: object): never {
  const response = { data, status, statusText: '', headers: {}, config } as AxiosResponse;
  throw new AxiosError(String((data as { message?: string }).message ?? 'Error'), String(status), config, null, response);
}

export function mockAdapter(viewerId: number): AxiosAdapter {
  return async (config) => {
    await new Promise((r) => setTimeout(r, 120));
    const url = (config.url ?? '').replace(/^\/api/, '');
    const method = (config.method ?? 'get').toLowerCase();
    const p = (config.params ?? {}) as Record<string, string | number | undefined>;
    const body = typeof config.data === 'string' && config.data ? JSON.parse(config.data) : {};
    const mine = viewerId >= 10;
    const visible = () => (mine ? tasks.filter((t) => t.assignee.id === viewerId) : tasks);
    const find = (id: string) => tasks.find((t) => t.id === Number(id)) ?? fail(config, 404, { message: 'Not found' });
    let m: RegExpMatchArray | null;

    if (method === 'get' && url === '/tasks') {
      if (!p.tab && !p.page) return ok(config, visible().map(detail));
      let rows = visible();
      if (p.tab === 'completed') rows = rows.filter((t) => t.status === 'completed');
      if (p.tab === 'active') rows = rows.filter((t) => t.status !== 'completed');
      if (p.tab === 'mine') rows = rows.filter((t) => t.assignee.id === viewerId || t.assigner.id === viewerId);
      if (p.state === 'completed') rows = rows.filter((t) => t.status === 'completed');
      if (p.state === 'active') rows = rows.filter((t) => t.status !== 'completed');
      if (p.status) rows = rows.filter((t) => t.status === p.status);
      if (p.q) rows = rows.filter((t) => `${t.title} ${t.project.name} ${name(t.assignee)}`.toLowerCase().includes(String(p.q).toLowerCase()));
      const page = Number(p.page ?? 1);
      return ok(config, { data: rows.slice((page - 1) * 10, page * 10).map(listItem), meta: { total: rows.length, page, per_page: 10, last_page: Math.max(1, Math.ceil(rows.length / 10)) } });
    }
    if (method === 'get' && url === '/home') {
      const rows = visible();
      const count = (s: string) => rows.filter((t) => t.status === s).length;
      const current = rows.find((t) => t.running) ?? rows.filter((t) => !['completed', 'review'].includes(t.status)).sort((a, b) => a.start - b.start)[0];
      const ext = extensions()[0];
      return ok(config, {
        status_counts: { in_progress: count('in_progress'), pending: count('pending'), todo: count('todo'), review: count('review'), technical_support: 0, deadline_missed: count('deadline_missed') },
        ...(mine
          ? {
              current: current ? listItem(current) : null,
              extension: ext ? { id: ext.id, task_title: ext.task.title, from: ext.status === 'pending' ? ext.task.deadline : null, requested: ext.requested_deadline, status: ext.status } : null,
            }
          : {
              needs: [
                ...(tasks.find((t) => t.id === 3)?.pendingExt ? [{ key: 'extensions', count: 1, label: 'Deadline extension to decide', detail: 'Victor Adeleye · Contour Fajaas Africa', href: '/dashboard/tasks?view=ext' }] : []),
                { key: 'leave', count: 2, label: 'Leave applications pending', detail: 'Linda Ekeh, Temitayo Akintunde', href: '/dashboard/leave' },
                { key: 'client_complaints', count: 2, label: 'Client complaints pending', detail: 'Complaints #1 and #2', href: '/dashboard/complaints' },
                { key: 'staff_complaints', count: 1, label: 'Staff complaint pending', detail: 'Complaint #7', href: '/dashboard/staff-complaints' },
              ],
              pipeline: {
                active: { total: 1, items: [{ id: 5, name: 'TopMart', category: 'Website Development', flag: 'Task timer running' }] },
                pending: {
                  total: 48,
                  items: [
                    { id: 11, name: 'SALAMAT', category: 'DPL Partnership', flag: 'No work activity for 1+ week' },
                    { id: 12, name: 'Temitope Oyewole', category: 'DPL Outright', flag: 'No tasks assigned' },
                    { id: 13, name: 'Dr Gloria Esoimeme', category: 'DPL Outright', flag: 'No work activity for 1+ week' },
                  ],
                },
                completed: { total: 4, items: ['QueenbodySecret', 'TopMart', 'Oladoyin taiwo', 'Adan Idet'].map((name, i) => ({ id: 20 + i, name, category: 'Website Development' })) },
              },
            }),
      });
    }
    if (url === '/messages/general' || /^\/messages\/direct\/\d+$/.test(url)) {
      const key = url === '/messages/general' ? 'general' : `u${url.split('/').pop()}`;
      const thread = (threads[key] ??= []);
      if (method === 'post') {
        thread.push({ id: Date.now(), content: body.content, sender_id: viewerId, sender: { id: viewerId, first_name: viewerId >= 10 ? 'Victor' : 'Olubukola', last_name: viewerId >= 10 ? 'Adeleye' : 'Ige' }, created_at: new Date().toISOString() });
      }
      return ok(config, thread);
    }
    if (method === 'get' && url === '/messages/inbox') {
      const last = (t: typeof chat) => (t.length ? { content: t.at(-1)!.content, sender: `${t.at(-1)!.sender.first_name} ${t.at(-1)!.sender.last_name}`, mine: t.at(-1)!.sender_id === viewerId, at: t.at(-1)!.created_at } : null);
      return ok(config, {
        general: { last: last(threads.general ?? []) },
        projects: [{ id: 20, name: 'QueenbodySecret', last: last(chat) }, { id: 5, name: 'TopMart', last: null }],
        direct: Object.keys(threads).filter((k) => k[0] === 'u').map((k) => ({ user_id: Number(k.slice(1)), last: last(threads[k]), unread: k === 'u11' ? 2 : 0 })),
      });
    }
    if (method === 'get' && url === '/memos') return ok(config, memos);
    if (method === 'get' && (m = url.match(/^\/memos\/(\d+)$/))) return ok(config, memos.find((x) => x.id === Number(m![1])) ?? fail(config, 404, {}));
    if (method === 'get' && url === '/sentiments') {
      const s = (id: number, sentiment: string, flagged: boolean, feedback: string, daysAgo: number, who: { first_name: string; last_name: string }) => ({ id, sentiment, is_flagged: flagged, feedback, recorded_at: ago(daysAgo), client: who });
      return ok(config, [
        s(1, 'satisfied', false, 'The new homepage looks great, thank you!', 0.2, { first_name: 'Temitope', last_name: 'Oyewole' }),
        s(2, 'dissatisfied', true, 'Still waiting on the SMTP fix from last week.', 0.5, { first_name: 'Gloria', last_name: 'Esoimeme' }),
        s(3, 'satisfied', false, '', 0.8, { first_name: 'Adan', last_name: 'Idet' }),
        s(4, 'satisfied', false, 'Quick turnaround.', 9, { first_name: 'Oladoyin', last_name: 'Taiwo' }),
      ]);
    }
    if (method === 'get' && url === '/complaints') {
      return ok(config, [
        { id: 2, name: 'Temitayo Matthew Akintunde', email: 'akinstemi123@gmail.com', product_manager_name: 'Linda', developer_name: 'Hydee', detailed_explanation: 'Slow timer', status: 'pending', created_at: ago(170) },
        { id: 1, name: 'Adeleke Toyin', email: 'adelekedewunmi@gmail.com', product_manager_name: 'saka maria', detailed_explanation: 'Pages load slowly on mobile.', status: 'pending', created_at: ago(171) },
        { id: 3, name: 'Adan Idet', email: 'adan@example.com', detailed_explanation: 'Logo was wrong colour.', status: 'resolved', review_comments: 'Fixed and re-sent.', created_at: ago(200) },
      ]);
    }
    if (method === 'get' && url === '/leave') return ok(config, leave);
    if (method === 'put' && (m = url.match(/^\/leave\/(\d+)\/decide$/))) {
      const l = leave.find((x) => x.id === Number(m![1]));
      if (l) l.status = body.status;
      return ok(config, {});
    }
    if (method === 'get' && url === '/queries') return ok(config, queries);
    if (method === 'get' && url === '/staff-complaints') return ok(config, staffComplaints);
    if (method === 'put' && (m = url.match(/^\/staff-complaints\/(\d+)$/))) {
      const c = staffComplaints.find((x) => x.id === Number(m![1]));
      if (c) Object.assign(c, { status: body.status, review_comments: body.review_comments ?? null });
      return ok(config, {});
    }
    if (method === 'get' && url === '/deadline-requests') return ok(config, extensions());
    if (method === 'get' && url === '/projects') return ok(config, sampleProjects());
    if (method === 'get' && (m = url.match(/^\/projects\/(\d+)\/messages$/))) return ok(config, chat);
    if (method === 'post' && (m = url.match(/^\/projects\/(\d+)\/messages$/))) {
      chat.push({ id: chat.length + 1, content: body.content, sender_id: viewerId, sender: { id: viewerId, first_name: viewerId >= 10 ? 'Victor' : 'Olubukola', last_name: viewerId >= 10 ? 'Adeleye' : 'Ige' }, created_at: new Date().toISOString() });
      return ok(config, {});
    }
    if (method === 'get' && (m = url.match(/^\/projects\/(\d+)$/))) {
      const p = sampleProjects().find((x) => x.id === Number(m![1])) ?? fail(config, 404, { message: 'Not found' });
      return ok(config, {
        ...p,
        description: 'Website Development Project',
        manager: people.titi,
        members: [people.titi, people.victor, people.ashe, people.emma].map((u, i) => ({ id: i + 1, project_id: p.id, user_id: u.id, user: { ...u, role: u.id >= 10 ? 'staff' : 'project_manager' } })),
        tasks: tasks.filter((t) => t.project.id === p.id),
        resources: [{ id: 1, project_id: p.id, name: 'Brand guidelines', url: 'https://example.com', type: 'document', uploaded_by: 2, created_at: p.created_at }],
        plans: [{
          id: 1, project_id: p.id, title: 'Standard eCommerce website Development', description: 'To build a functional standard ecommerce website in 13days',
          deliverables: ['Website Development', 'Review + SMTP', 'Website adjustment', 'Final review', 'Walkthrough with client', 'Client Followup on reviews +Feedback & Missing content (if need be)', 'Adjustment from Client feedback']
            .map((title, i) => ({ id: i + 1, plan_id: 1, title, status: i < plan ? 'completed' : 'pending' })),
        }],
      });
    }
    if (method === 'put' && (m = url.match(/^\/projects\/\d+\/plans\/\d+\/deliverables\/(\d+)$/))) {
      plan = body.status === 'completed' ? Math.max(plan, Number(m[1])) : Number(m[1]) - 1;
      return ok(config, {});
    }
    if (method === 'get' && url === '/bookings') return ok(config, bookings);
    if (method === 'post' && url === '/bookings') {
      bookings.push({ ...meet(Date.now(), '', 'general', 0, 0, 0, people.ige, []), ...body });
      return ok(config, bookings[bookings.length - 1]);
    }
    if ((m = url.match(/^\/bookings\/(\d+)$/))) {
      const i = bookings.findIndex((x) => x.id === Number(m![1]));
      if (method === 'put') Object.assign(bookings[i], body);
      if (method === 'delete') bookings.splice(i, 1);
      return ok(config, {});
    }
    if (method === 'get' && url === '/sops') return ok(config, sops);
    if (method === 'post' && url === '/sops') {
      const sop = { id: sopSeq++, title: body.title, description: body.description ?? null, category: body.category ?? null, segments: [] };
      sops.unshift(sop);
      return ok(config, sop);
    }
    if ((m = url.match(/^\/sops\/(\d+)$/))) {
      const i = sops.findIndex((x) => x.id === Number(m![1]));
      if (i < 0) fail(config, 404, {});
      if (method === 'put') Object.assign(sops[i], body);
      if (method === 'delete') return ok(config, sops.splice(i, 1));
      return ok(config, sops[i]);
    }
    if ((m = url.match(/^\/sops\/(\d+)\/segments(?:\/(\d+))?$/))) {
      const sop = sops.find((x) => x.id === Number(m![1])) ?? fail(config, 404, {});
      if (method === 'post') sop.segments.push({ id: Date.now(), title: body.title, content: body.content, order_index: body.order_index ?? 0 });
      if (method === 'delete') sop.segments = sop.segments.filter((g) => g.id !== Number(m![2]));
      return ok(config, {});
    }
    if (method === 'get' && url === '/issues') return ok(config, issues);
    if (method === 'post' && url === '/issues') {
      issues.unshift({ id: Date.now(), title: body.title, description: body.description, status: 'pending', created_at: new Date().toISOString() });
      return ok(config, issues[0]);
    }
    if (method === 'put' && url === '/auth/profile') return ok(config, { ...people.ige, ...body });
    if (method === 'post' && url === '/auth/change-password') return ok(config, {});
    if (method === 'get' && url === '/notifications') return ok(config, structuredClone(notifications));
    if ((m = url.match(/^\/notifications\/(\d+)(\/read)?$/))) {
      const i = notifications.findIndex((x) => x.id === Number(m![1]));
      if (method === 'put') notifications[i].read = true;
      if (method === 'delete') notifications.splice(i, 1);
      return ok(config, {});
    }
    if (method === 'post' && url === '/notifications/mark-all-read') {
      notifications.forEach((x) => (x.read = true));
      return ok(config, {});
    }
    if (method === 'get' && url === '/review-links') return ok(config, reviewLinks);
    if (method === 'get' && url === '/departments') return ok(config, ['Design', 'Web', 'Marketing']);
    if (method === 'get' && url === '/kpi-report/productivity') {
      const days = Array.from({ length: 22 }, (_, i) => {
        const d = new Date(Date.now() - (22 - i) * 86400000).toISOString().slice(0, 10);
        return { date: d, hours: [0, 1.5, 3.2, 4.5, 6, 2.4, 5.1][i % 7] };
      });
      const employees = [people.victor, people.ashe].map((u) => ({ ...u, role: 'staff', effective_department: 'Web' }));
      if (!p.employee_id) return ok(config, { employees, from: days[0].date, to: days[21].date });
      return ok(config, {
        employees, from: days[0].date, to: days[21].date, chart: days,
        daily_details: days.slice(-5).reverse().map((d) => ({ date: d.date, total_span_seconds: d.hours * 3600, tasks: d.hours ? ['Logo files for TopMart', 'Homepage hero'] : [], status: d.hours >= 4 ? 'good' : d.hours >= 2 ? 'fair' : 'poor' })),
        task_breakdown: [{ title: 'Logo files for TopMart', status: 'completed', estimated_minutes: 120, actual_minutes: 100, percentage: 120 }, { title: 'Homepage hero', status: 'in_progress', estimated_minutes: 180, actual_minutes: 240, percentage: 75 }],
        overview: { total_working_days: 22, active_days: 18, average_daily_hours: 3.4, productivity_score: 92, unique_task_count: 9 },
        staff_summary: { id: 10, name: 'Victor Adeleye', role: 'staff', department: 'Web', total_hours: 74.5, active_days: 18, tasks_completed: 7, tasks_in_progress: 2, productivity_score: 92 },
      });
    }
    if (method === 'get' && url === '/support') return ok(config, support);
    if (method === 'get' && url === '/badges') return ok(config, mine ? { inbox: 3, penalties: 1, support: 0 } : { inbox: 1, people: 3, clients: 2, reviews: 1 });
    if (method === 'get' && url === '/notes') return ok(config, notes);
    if (method === 'post' && url === '/notes') {
      notes.unshift({ id: noteSeq++, title: body.title, content: body.content, color: body.color, updated_at: new Date().toISOString() });
      return ok(config, notes[0]);
    }
    if ((m = url.match(/^\/notes\/(\d+)$/))) {
      const i = notes.findIndex((x) => x.id === Number(m![1]));
      if (method === 'put') Object.assign(notes[i], body, { updated_at: new Date().toISOString() });
      if (method === 'delete') notes.splice(i, 1);
      return ok(config, notes[i] ?? {});
    }
    if (method === 'get' && url === '/users') {
      const roles: Record<number, [string, string, string?]> = {
        1: ['operations_manager', 'available'], 2: ['project_manager', 'available', 'Automation'], 10: ['staff', 'busy', 'Web'],
        11: ['staff', 'offline', 'Copywriting'], 12: ['intern', 'available'], 13: ['team_lead', 'on_leave'],
      };
      return ok(config, Object.values(people).map((u) => ({ ...u, username: u.first_name.toLowerCase(), email: `${u.first_name.toLowerCase()}@wcdigitalagency.com`, role: roles[u.id][0], work_status: roles[u.id][1], department: roles[u.id][2] ?? null, status: u.id === 12 ? 'pending' : 'active', is_active: u.id !== 13, break_one_time: ({ 2: '15:00', 10: '14:00', 11: '11:30', 12: '02:30' } as Record<number, string>)[u.id] ?? null, created_at: ago(30 * u.id) })));
    }
    if (method === 'get' && url === '/notifications/unread-count') return ok(config, { count: 2 });
    if (method === 'get' && (m = url.match(/^\/tasks\/(\d+)\/events$/))) return ok(config, events(find(m[1])));
    if (method === 'get' && (m = url.match(/^\/tasks\/(\d+)$/))) return ok(config, detail(find(m[1])));

    if (method === 'post' && (m = url.match(/^\/tasks\/(\d+)\/timer\/start$/))) {
      const t = find(m[1]);
      if (t.description && !t.read && !body.confirm_read) fail(config, 409, { code: 'confirm_read', message: 'Read the instructions before you start.', instructions: t.description });
      if (body.confirm_read) t.read = true;
      if (t.start > 0 && !body.confirm_early) {
        const clash = tasks.find((x) => x.id !== t.id && x.assignee.id === t.assignee.id && x.start <= 0 && x.due > 0);
        fail(config, 409, { code: 'confirm_early', message: 'Start early?', scheduled_start: iso(t.start), clash: clash ? { id: clash.id, title: clash.title, deadline: iso(clash.due) } : null });
      }
      tasks.forEach((x) => { if (x.running) { x.logged = logged(x); x.running = false; } });
      t.running = true;
      runningSince = { [t.id]: Date.now() };
      if (t.status !== 'deadline_missed') t.status = 'in_progress';
      return ok(config, detail(t));
    }
    if (method === 'post' && (m = url.match(/^\/tasks\/(\d+)\/(timer\/stop|submit)$/))) {
      const t = find(m[1]);
      t.logged = logged(t);
      t.running = false;
      t.status = m[2] === 'submit' ? 'review' : t.status === 'deadline_missed' ? t.status : 'on_hold';
      return ok(config, detail(t));
    }
    if (method === 'post' && (m = url.match(/^\/tasks\/(\d+)\/instructions\/read$/))) {
      find(m[1]).read = true;
      return ok(config, { read: true });
    }
    if (method === 'patch' && (m = url.match(/^\/tasks\/(\d+)\/extension-requests\/\d+$/))) {
      find(m[1]).pendingExt = false;
      return ok(config, {});
    }
    if (method === 'delete' && (m = url.match(/^\/tasks\/(\d+)$/))) {
      tasks = tasks.filter((t) => t.id !== Number(m![1]));
      return ok(config, {});
    }
    return ok(config, {});
  };
}
