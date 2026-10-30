# WC Digital Agency Platform — Redesign files

This folder is the design handoff for rebuilding the Agency Platform frontend (Next.js 14 + Tailwind) and the task features in the Laravel backend.

## What's in here

| Path | What it is |
| --- | --- |
| `screens/*.dc.html` | One file per screen from the design canvas. Read them for layout, spacing, colours, copy and behaviour. They are prototypes, not production code. |
| `canvas.json` | Map of every screen: title, size and position on the canvas. |
| `tokens/tailwind.tokens.js` | Colours, fonts, radii and sizes ready to merge into `tailwind.config.js`. |
| `CHANGELOG.md` | Every design decision made so far, newest first. |
| `HANDOFF_SPEC.md` | **Add this yourself:** open the spec link below, use its menu to download as Markdown, and save it here. |

- Live design canvas: https://claude.ai/artifact/Si14u9G1cdEWdaQghTBB7Z
- Handoff spec (the full build instructions): https://claude.ai/artifact/CmmvzZomoZcjzWh8Ng1mjG

## How to read a screen file

Each `.dc.html` file has three parts:

1. `<helmet>` — fonts and a few global CSS rules (sticky sidebar, pulse animation).
2. `<x-dc> … </x-dc>` — the markup. Styles are inline, so every size and colour is visible. `{{name}}` is a value from the script; `<sc-for list="{{rows}}" as="t">` repeats a block per item; `<sc-if value="{{x}}">` shows a block only when `x` is true; `<dc-import name="Topbar">` embeds another screen file as a component.
3. `<script type="text/x-dc">` — `renderVals()` returns the data and click handlers the markup uses. Treat it as the UI behaviour spec (what happens on Start, Submit, tab changes, pagination), not as code to copy.

The files depend on a canvas runtime (`support.js`) that isn't included, so they won't run on their own. Use the live canvas link to see them rendered.

## Screen index

| Screen file | Page | Role | Device |
| --- | --- | --- | --- |
| `Topbar.dc.html` | Sidebar navigation (component; name is historical) | Both (prop `role`) | Desktop |
| `MTabBar.dc.html` | Bottom dock (component) | Both (prop `role`) | Mobile |
| `Main.dc.html` / `MHome.dc.html` | Home | Manager | Desktop / Mobile |
| `StaffHome.dc.html` / `MStaffHome.dc.html` | Home | Staff | Desktop / Mobile |
| `Tasks.dc.html` / `MTasks.dc.html` | Tasks | Manager | Desktop / Mobile |
| `StaffTasks.dc.html` / `MStaffTasks.dc.html` | My tasks | Staff | Desktop / Mobile |
| `StaffEarlyStart.dc.html` / `MStaffEarlyStart.dc.html` | Early-start prompt (My tasks at 10:30 AM) | Staff | Desktop / Mobile |
| `TaskPanel.dc.html` | Task panel: Details + History (component; props `task`, `role`) | Both | Shared |
| `TaskDetail.dc.html` / `MTaskDetail.dc.html` | Task panel open over Tasks | Manager | Desktop / Mobile |
| `StaffTaskDetail.dc.html` / `MStaffTaskDetail.dc.html` | Task panel open over My tasks | Staff | Desktop / Mobile |
| `Projects.dc.html` / `MProjects.dc.html` | Projects | Both | Desktop / Mobile |
| `ProjectDetail.dc.html` / `MProject.dc.html` | Project detail | Both | Desktop / Mobile |
| `Inbox.dc.html` / `MInbox.dc.html`, `MChat.dc.html` | Inbox (chats + memos), chat thread | Both | Desktop / Mobile |
| `Workspace.dc.html` / `MCalendar.dc.html` | Calendar (bookings) | Manager | Desktop / Mobile |
| `People.dc.html` / `MPeople.dc.html` | People: leave, team, queries, staff complaints | Manager | Desktop / Mobile |
| `Clients.dc.html` / `MClients.dc.html` | Clients: sentiment + complaints | Manager | Desktop / Mobile |
| `Insights.dc.html` / `MInsights.dc.html` | Insights (KPI — redesign on hold) | Manager | Desktop / Mobile |
| `Knowledge.dc.html` / `MLibrary.dc.html` | Library: SOPs + notes | Both | Desktop / Mobile |
| `Admin.dc.html` / `MAdmin.dc.html` | Admin: users | Manager | Desktop / Mobile |
| `Settings.dc.html` / `MSettings.dc.html` | Settings + report an issue | Both | Desktop / Mobile |
| `Sidebar.dc.html` | Search palette (⌘K, optional; name is historical) | Both | Desktop |
| `MMore.dc.html` | More menu | Both | Mobile |

## Using this with Claude Code

1. Copy this `design/` folder into the root of your frontend repo and commit it.
2. Download the handoff spec as Markdown into `design/HANDOFF_SPEC.md`.
3. Work through the build order in section 9 of the spec, one step per branch. Example prompts:

> **Step 1:** "Read design/README.md, design/HANDOFF_SPEC.md (sections 3 and 4) and design/tokens/tailwind.tokens.js. Add the tokens and fonts to our Tailwind setup and build the shared components listed in section 3, with a /dev/components page showing every variant. Don't change any existing pages yet."

> **Step 2:** "Using design/screens/Topbar.dc.html and MTabBar.dc.html and spec section 4, replace our current layout with the pinned sidebar (manager and staff menus by role) and the mobile bottom dock below 1024px."

> **Steps 3–4:** "Implement spec sections 7 and 8 for tasks: migrations for task_events, the new task columns, task_reads, timer and estimate tables; the server rules and endpoints; then rebuild the Tasks page from design/screens/Tasks.dc.html, the staff My tasks page from StaffTasks.dc.html, and the task panel from TaskPanel.dc.html. Real data only — the sample tasks in the screen files are placeholders."

4. After each step, check the acceptance checks in spec section 9 in the browser before merging.

## Data in the screens

Names, projects, dates and counts come from screenshots of the current app. Made-up items exist only to fill screens: the 22 extra staff tasks and 23 extra manager tasks, history entry times, and anything in `[square brackets]`. Everything must come from the API in the build.
