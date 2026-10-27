# WC Digital Agency Platform — Redesign Handoff Spec

Oct 27, 2026 

## 1. Purpose and how to use this spec

This spec turns the redesign canvas into build instructions for the existing Agency Platform codebase. It covers the visual system, layout, roles, every page, the new task features and the backend they need.

**Design source:** the canvas at [WC Digital Agency Platform Redesign](https://claude.ai/artifact/Si14u9G1cdEWdaQghTBB7Z). Each screen is an artboard file named below (for example `Tasks.dc.html`). The files are HTML prototypes, not production code: copy layout, spacing, colours and behaviour from them, and rebuild them as Next.js components.

**Working with Claude Code:**

1. Put the exported design files in the repo under `/design`.
2. Give Claude Code this spec plus the relevant artboard file for each step.
3. Build one step at a time in the order in section 9, and check each in the browser before moving on.
4. For later design changes, ask for a change note (screens changed, what changed, new behaviour) and apply it on its own git branch.

**Real vs sample data in the mockups:** names, projects, tasks, dates and counts come from the current app's screenshots. Some data is made up only to fill screens and must come from the API in the build:

- the 22 extra staff tasks on the staff dashboard and the 23 extra tasks on the manager Tasks list
- history entry times (creation, edits, reads) and instruction text, shown as `[placeholders]`
- Victor's running task title (`[Website task title]`) and the clash task name

## 2. Stack and approach

Keep the existing stack: Next.js 14 App Router, Tailwind and React Query on the frontend; Laravel 11 with Sanctum, Reverb and Spatie on the backend; LiveKit for calls.

- **One responsive app, not two.** Desktop and the mobile PWA share the same routes and components. Layout switches at a breakpoint: sidebar at `lg` (1024px) and up, bottom dock below it.
- **Mobile feels native.** Full-bleed screens, large titles, bottom sheets for dialogs, a floating dock, 44px minimum tap targets, and safe-area padding for the iOS home bar.
- **Server is the source of truth.** Timers, deadlines, history, pagination, date filters and export all run on the server. The UI never decides whether something was late.
- **Live updates** over Reverb for timers, task history and badges (pending counts).

## 3. Design system

Warm stone background, near-black ink, and the brand yellow as the single accent. Put these in `tailwind.config` as named tokens; never hard-code hex values in components.

**Colours**

| Token | Hex | Use |
| --- | --- | --- |
| `stone` | #EFEDE7 | Page background |
| `surface` | #FFFFFF | Cards, panels, inputs on stone |
| `surface-2` | #F7F6F2 | Inner panels, schedule boxes, rows on white |
| `ink` | #121212 | Text, sidebar, dark hero cards, primary buttons |
| `ink-2` | #4D4A44 | Secondary text |
| `muted` | #6A665F | Labels, meta text (passes 4.5:1 on stone and white) |
| `line` | #ECEAE4 | Row dividers |
| `yellow` | #FFD43B | Accent: active nav, badges, Submit, key numbers on dark |
| `dark-2` | #1E1D1B / #2A2926 | Panels and chips inside dark cards |

**Status colours** (text on tint)

| Status | Text | Tint |
| --- | --- | --- |
| Deadline missed / danger | #C0362C | #FBE7E4 |
| Pending / warning / extension | #8A5A00 | #FCF0CC |
| Completed / success | #1F7A4A | #E2F2E7 |
| In review / info | #1E4797 | #DCE6F7 |
| To do / neutral | #4D4A44 | #ECEAE4 |
| Instructions panel | #121212 | #FFF6CC |

**Typography** (Google Fonts)

- Display: Bricolage Grotesque 700, tight tracking (-0.02 to -0.04em). Page titles 56px desktop / 40px mobile; section titles 22–30px.
- UI: Geist 400–700. Body 14–16px, labels 11–12.5px uppercase with 0.06em tracking.
- Numbers and timers: Geist Mono 600.

**Shape and spacing**

- Cards 24–30px radius, no borders, no shadows (shadow only on floating menus, drawers and the mobile dock).
- Buttons and controls are pills (999px radius). Heights: 40px compact, 44–48px standard, 50–54px mobile primary.
- Page padding 28–40px desktop, 18px mobile; gaps 10–22px.

**Core components**

- `Button`: primary (ink), accent (yellow), secondary (stone or white), danger (red on red tint).
- `StatusPill`, `Badge` (yellow count), `Avatar` (initials; removed from the task table).
- `Tabs` (pill group, active = ink), `SegmentedFilter`, `SearchField`, `DateRange` (From … to …).
- `Pagination`: "Showing 1–10 of N", ‹ numbered pages ›, arrows dim on first and last page.
- `ExportMenu`: Excel, CSV, PDF.
- `ScheduleBoxes`: Start and Deadline side by side, deadline red when missed.
- `Drawer` (desktop, slides from right) and `Sheet` (mobile, from bottom with grabber).

## 4. Layout and navigation

Desktop uses a pinned black sidebar; mobile uses a floating bottom dock. Artboards: `Topbar.dc.html` (the sidebar component, despite its name) and `MTabBar.dc.html` (the dock).

**Desktop sidebar** (248px, `lg` and up)

- Pinned: `position: sticky; top: 0; height: 100vh`, scrolls on its own if the menu is taller than the window. Only the page content scrolls.
- Top: yellow "wc" logo + wordmark and a notifications bell with unread dot. No search button.
- Menu items are pills; active item = yellow background, ink text. Pending counts on yellow badges.
- Bottom: the profile card (initials, name, role) linking to Settings. No on-shift / clock-in status.
- Below `lg` the sidebar sits above the content and scrolls away normally.

**Menus by role**

| Role | Group | Items |
| --- | --- | --- |
| Manager | (top) | Home, Projects, Tasks (badge), Inbox, Calendar |
| Manager | Team and clients | People (badge), Clients (badge), Insights, Library |
| Manager | System | Admin, Settings |
| Staff | (top) | Home, Projects, My tasks (badge), Inbox |
| Staff | Requests | Leave and complaints, Received penalties, Technical support |
| Staff | Account | Settings |

**Mobile dock** (below `lg`)

- Floating black pill, 16px from screen edges, 24px above the home bar; active tab = yellow pill.
- Tabs: Home, Projects, Tasks (badge), Inbox, More (badge = total pending). Staff Home and Tasks point to the staff versions.
- More opens a tile grid of every other section (People, Clients, Calendar, Insights, Library, Admin, Settings, Report an issue) plus dark mode and sign out.
- Task panels open as full-screen sheets with no dock.

**Page frame:** title block (eyebrow + 56px title + one-line description), actions on the right, then content. Max content width 1280px.

## 5. Roles and permissions

Managers create and change tasks; staff run timers on tasks assigned to them. Enforce every rule on the server with the existing Spatie roles; the UI only hides what a role can't do.

| Action | Manager (Operations Manager, Team Lead, Project Manager) | Staff and interns |
| --- | --- | --- |
| Create, edit, delete a task | Yes | No |
| Start / stop timer, submit for review | No | Own assigned tasks only, including tasks In review or with an extension pending |
| Approve or decline extension requests | Yes | No |
| Request an extension | No | Own tasks |
| Approve or reject leave, send queries | Yes | No |
| Lock a task against early start | Yes | No |
| See task history | All tasks they manage | Own tasks (same full history, including manager edits) |
| Export tasks | Yes | Own tasks |
| KPI report | Team view + any person | Own page only |

The 8 roles from the current app (Operations Manager down to Intern, plus Customer Support Officer) map onto these two columns. Confirm Customer Support Officer's column before building.

## 6. Pages

Every desktop page has a mobile version; sub-pages from the old app are now tabs inside a hub page. Artboard names are the files to copy from.

| Page | Desktop / mobile artboard | What it contains |
| --- | --- | --- |
| Manager home | `Main` / `MHome` | Greeting; black "Needs you" card (pending extensions, leave, client and staff complaints, each linking to where you act); task status counts + proportion bar; project pipeline (Active, Pending with flags, Completed); My tasks list with search, date range, Start/Deadline, Edit/Delete |
| Staff home | `StaffHome` / `MStaffHome` | Running-task card (title, est., timer + Stop/Submit, Start/Deadline, one-line instructions row); technical support count; extension request status; My tasks: All/Active/Completed, search, date range, 10 per page |
| Tasks (manager) | `Tasks` / `MTasks` | Toolbar (search, date range, Export) above tabs (All tasks, My tasks, Extension requests); extension banner; list only, 10 per page (section 7) |
| My tasks (staff) | `StaffTasks` / `MStaffTasks` | Desktop matches the manager Tasks page: toolbar (search, date range, Export) above tabs Active / Completed / Extension requests; list 10 per page with columns Task, Status, Assigned by, Time, Schedule, Actions (Start/Stop + Submit). Mobile keeps compact task cards |
| Task panel | `TaskDetail`, `StaffTaskDetail` / `MTaskDetail`, `MStaffTaskDetail` (component `TaskPanel`) | Details and History tabs (section 7) |
| Projects | `Projects` / `MProjects` | Overdue / urgent / completed-this-week strip; category filter; project tiles by category with "View all N" |
| Project detail | `ProjectDetail` / `MProject` | Dark header with progress ring and facts (timeline, duration, manager, created); tabs Overview, Tasks, Resources, Team chat; plan checklist; chat preview |
| Inbox | `Inbox` / `MInbox`, `MChat` | Chats tab (channels, project chats, DMs, voice and video call buttons) and Memos tab |
| Calendar | `Workspace` / `MCalendar` | Month grid with meeting days highlighted; meeting cards with edit and delete |
| People | `People` / `MPeople` | Tabs: Leave (approve/reject cards + history), Team directory, Queries, Staff complaints |
| Clients | `Clients` / `MClients` | Weekly sentiment summary, feedback list, client complaints with Review |
| Insights | `Insights` / `MInsights` | KPI report and Estimate drift tabs; filters; daily hours chart; breakdown tabs (to be redesigned: section 10) |
| Library | `Knowledge` / `MLibrary` | SOPs (empty state + New SOP) and personal notes |
| Admin | `Admin` / `MAdmin` | User counts; user list with role picker, status, reset password, deactivate |
| Settings | `Settings` / `MSettings` | Profile, password, appearance (light, dark, device), report an issue + your reports |
| Search palette | `Sidebar` | Optional: opens only with the ⌘K shortcut (no button) — pages, records and quick actions |
| More (mobile only) | `MMore` | Tile grid of all other sections, dark mode, sign out |

The early-start prompt has its own artboards: `StaffEarlyStart` and `MStaffEarlyStart` (section 7).

## 7. Task features

These are the behaviours agreed during the redesign. Each needs the backend in section 8.

### 7.1 Task list (desktop Tasks page)

- List view only. The board view and the List/Board switch are removed.
- Toolbar order: search, date range (From … to …), Export. The All tasks / My tasks / Extension requests tabs sit on the row below. On the Extension requests tab the toolbar is hidden.
- Fixed grid columns so actions never wrap: Task (flex) · Status 132px · Assignee 104px · Time 104px · Schedule (flex) · Actions 88px. Below 820px the table scrolls sideways.
- Task cell: title (opens the task panel), project, and a "Has instructions" marker when the task has instructions (no read receipts).
- Status on one line as a pill. Assignee name breaks one word per line, no initials.
- Time: logged (mono) with "est. 2h" under it. Schedule: Start and Deadline, deadline red when missed.
- Actions: Edit and Delete icon buttons (managers only).

### 7.2 Pagination, date filter and export

- 10 tasks per page everywhere a task list appears (manager Tasks, staff dashboard, mobile lists). Footer "Showing 11–20 of 27 tasks" with numbered pages. Changing a tab, search or date range resets to page 1.
- Date range filters by the task's schedule window overlapping the range. Done on the server: `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
- Export menu: Excel, CSV, PDF. Exports every task matching the current tab, search and date range, not just the visible page. Generated on the server; large exports queue and notify when ready.

### 7.3 Schedule shown on every task

Every task card and row shows the manager's scheduled Start and Deadline (date and time) side by side, instead of only "Due …". The actual timer start lives in the task history, not on the card.

### 7.4 Role-based actions

- Managers: Edit and Delete on every task row and card.
- Staff: Start/Stop and Submit on their own tasks. Submit stops the timer and moves the task to In review.
- **In review stays workable.** Start/Stop and Submit remain available on In review tasks, because staff may continue the work after submitting. Restarting the timer moves the task back to In progress and is logged in the history; submitting again sends it back to review.
- **Extension pending stays workable.** A task with a pending extension request is not locked. The timer and Submit work normally until the request is approved or declined; the card notes "Extension requested — you can keep working while it's decided".
- Missed tasks without a request show a "Request extension" action alongside the timer buttons.

### 7.5 Running-task card (staff)

Compact by design. Shows: title, "Project · est. 2hr 59min", status pill, timer (32px desktop / 26px mobile) with a pulsing green dot, Stop/Start and Submit as 40px pills beside it, Start/Deadline boxes, and a one-line instructions row. Removed on purpose: "Timer running" label, "by [manager]", "Timer started …", "Started early" chip. Tapping the title opens the task panel.

### 7.6 Instructions

- Shown on the card as a one-line row: icon, "Instructions", a one-line preview, "Read". Tasks with none show nothing.
- **No read receipts and no "Updated" tag.** Managers don't see whether instructions were read, and edited instructions are not flagged on cards. Edits to instructions still appear in the task history.
- **Read before you start:** the first time a staff member taps Start on a task with instructions they haven't opened, a sheet shows the full text with "Got it, start timer". Once per task. Whether it was opened is tracked internally for this check only.
- In the staff task panel, the Details tab opens first with instructions at the top.

### 7.7 Starting early

Early starts are allowed, with guardrails:

1. Tapping Start before the scheduled start shows: "This task is scheduled for 1:01 PM — do you want to start early?" with Not yet / Start early.
2. If another of their tasks is scheduled right now, the same prompt adds: "You have [task] scheduled now (due 12:00 PM). Start this one anyway?"
3. Confirming logs a history entry: "Timer started early · 2h 31m before scheduled start".
4. Managers can set "Can't start before scheduled time" on a task; Start then reads "Opens at [time]".
5. Timers run only while the staff member is clocked in.

### 7.8 Estimates and deadlines

- Estimate = effort budget on total logged time; starting early doesn't change it. The deadline is absolute.
- At 80% of the estimate, notify the staff member. At 100%, the timer keeps running, the task shows "Over estimate +12 min" in red, and the manager is notified.
- Staff can request more estimate time the same way they request a deadline extension; approval is logged as an estimate edit.
- Every missed task is tagged with a cause: Late start, Over estimate, Waited on extension, Not started, or Manager change.

### 7.9 Task panel and history

- Opens as a right-hand drawer (desktop, 620px) or full-screen sheet (mobile) from any task title. Shared component, same content for both roles; only the header actions change.
- Header: project, title, status pills, assignee and creator, role actions.
- **Details tab:** instructions box first, then Assignee, Created by, Scheduled start, Deadline, Estimate, Time logged.
- **History tab:** summary tiles (time worked + sessions, start on time/early/late, finish early/late or estimate status, edits or extension status), filter chips (All, Work sessions, Edits, Deadlines), then a timeline grouped by day.
- Timeline markers: black = manager action, yellow = timer, grey = system, red = missed or estimate reached, dashed amber = waiting. Edits show old value struck through → new value, with the reason. Work sessions draw a bar with a red line at the deadline. A pending extension shows Approve/Decline inline for managers.
- Footer note: history is written by the server and can't be edited or deleted.

**Events to record:** created; assigned or reassigned; field edited (one entry per field, old → new, reason required for deadline and estimate); instructions edited; timer started (flag early, record clash); timer stopped (session length); deadline in 1 hour (system); deadline missed (system, note if the timer was running); estimate reached; extension requested, approved or declined; submitted; timer restarted after submit (back to In progress); approved or sent back; completed; deleted.

## 8. Backend (Laravel)

Every task action writes an event in the same database transaction as the action itself; everything else (panel, history, KPIs) is read from those events.

**New and changed tables**

| Table | Key columns | Notes |
| --- | --- | --- |
| `task_events` | id, task_id, actor_id (null = system), type, from (json), to (json), meta (json: reason, clash task, session minutes), created_at | Append-only. No update or delete routes. |
| `tasks` (add) | instructions (text), instructions_updated_at, scheduled_start_at, deadline_at, original_deadline_at, estimate_minutes, original_estimate_minutes, lock_early_start (bool) | Keep originals so KPIs can compare |
| `task_reads` | task_id, user_id, read_at, instructions_version | Internal only: drives the once-per-task read-before-start check; never shown to managers |
| `timer_sessions` | task_id, user_id, started_at, stopped_at, started_early (bool), clash_task_id | Existing timers: add the early-start fields |
| `estimate_requests` | task_id, requested_minutes, reason, status, decided_by, decided_at | Mirrors deadline extension requests |
| `task_outcomes` | task_id, assignee_id, on_time, start_delta_min, logged_min, estimate_min, send_backs, miss_cause, closed_at | One row per closed task; rebuilt from events if late events arrive |
| `kpi_daily` | user_id, date, tasks_due, on_time, late_starts, logged_min, clocked_min, send_backs | Nightly totals for the KPI page |

**Rules enforced on the server**

- Start: assignee only, clocked in, not deleted or completed. If before `scheduled_start_at`, require `confirm_early=true` (refuse when `lock_early_start`). Return any clashing task so the UI can show the prompt.
- Start and Submit are allowed on In review tasks. Starting moves the task back to In progress and writes a "timer restarted after submit" event.
- A pending extension or estimate request never blocks Start or Submit.
- First Start on a task with instructions the assignee has never opened: require `confirm_read=true` (records the open in `task_reads`).
- Deadline and estimate edits require a reason.
- Approved extensions move `deadline_at`; `original_deadline_at` never changes.

**Scheduled jobs**

- Every minute: deadline-in-1-hour reminders, deadline-missed events, estimate 80% and 100% checks on running timers.
- Nightly: rebuild `kpi_daily`; close out `task_outcomes` for tasks finished or missed that day.

**Broadcasting (Reverb):** task events to `task.{id}` (open panels update live); badge counts to `user.{id}`.

**Endpoints**

| Method and path | Purpose |
| --- | --- |
| `GET /tasks?tab=&q=&from=&to=&page=` (tab = all or mine; staff: active or completed) | Paginated list, 10 per page, with meta.total |
| `GET /tasks/export?format=&tab=&q=&from=&to=` (format = xlsx, csv or pdf) | Export all matching tasks (queued if large) |
| `GET /tasks/{id}` and `GET /tasks/{id}/events?type=` | Panel details and history (filter chips map to `type`) |
| `POST /tasks/{id}/timer/start` · `/stop` | Body: `confirm_early`, `confirm_read` |
| `POST /tasks/{id}/submit` · `/approve` · `/send-back` | Review flow |
| `POST /tasks/{id}/instructions/read` | Records that instructions were opened (internal) |
| `POST /tasks/{id}/extension-requests` · `/estimate-requests` and `PATCH …/{req}` | Request and decide |
| `PATCH /tasks/{id}` | Manager edits (reason required for deadline and estimate) |
| `GET /kpi/team?from&to&department` · `GET /kpi/staff/{id}?from&to` | KPI page (when built) |

## 9. Build order and acceptance checks

Build in this order; each step ships behind its own branch and is checked before the next starts. Steps 3 and 4 go together because the task UI depends on the new endpoints.

1. **Tokens and components.** Tailwind tokens, fonts, Button, StatusPill, Badge, Tabs, SearchField, DateRange, Pagination, ExportMenu, ScheduleBoxes, Drawer, Sheet.
   - Check: a component page renders every variant in light mode; text passes 4.5:1 contrast.
2. **Layout.** Pinned sidebar with manager and staff menus, mobile dock, More screen, page frame.
   - Check: sidebar stays put while content scrolls at 1280px; dock shows below 1024px; correct menu per role.
3. **Task backend.** `task_events`, new task columns, `task_reads`, timer rules, jobs, endpoints from section 8.
   - Check: every action in section 7 writes the right event; early start without confirmation is refused; deadline edit without a reason is refused.
4. **Task UI.** Manager Tasks list, staff My tasks and running card, task panel with History, read-before-start and early-start sheets, export.
   - Check: 10 per page with correct "Showing" counts; Edit/Delete never wrap at 1024px; Start on an unread task shows the instructions sheet; Start before schedule shows the early prompt and logs it; Start and Submit work on In review and extension-pending tasks.
5. **Home pages.** Manager and staff dashboards.
   - Check: "Needs you" counts match the source pages; staff My tasks paginates and filters by date.
6. **Remaining pages.** Projects, project detail, Inbox, Calendar, People, Clients, Library, Admin, Settings, search palette.
   - Check: every item from the old app's screenshots is reachable on desktop and mobile.
7. **KPI report.** After task events have collected for a few weeks (on hold, see section 10).

## 10. Open items

These are not designed or not decided yet; don't guess them in the build.

- [ ] **KPI report redesign** — on hold. Agreed direction: built from `task_outcomes` and `kpi_daily`; measures on-time delivery, start punctuality, estimate accuracy, first-time approval, utilisation; fairness rules for extensions, manager edits, leave and reassignment.
- [ ] **Staff-only pages** — Leave application, Send complaint, Received penalties, Technical support. Need screenshots of the current pages; sidebar links go to staff Home until then.
- [ ] **Staff screens feedback** — you noted things you don't like on the staff screens; collect those before step 4.
- [ ] **Colour theme** — current theme is stone and yellow; a purple variant was previewed but not adopted.
- [ ] **Dark mode** — the toggle exists, but no dark screens are designed.
- [ ] **Estimate drift tab and KPI breakdown tabs** — placeholders only.
- [ ] **Client portal** — client-facing screens not designed.
- [ ] **Customer Support Officer** — confirm whether this role acts as manager or staff.
- [ ] **Logo** — mockups use a "wc" stand-in; swap in the real logo files.
