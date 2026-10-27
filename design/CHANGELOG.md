# Design changelog

Newest first. Each entry is a change to apply in code.

| # | Change | Screens |
| --- | --- | --- |
| 15 | Staff desktop My tasks now matches the manager Tasks layout: toolbar (search, date range, Export) above Active / Completed / Extension requests tabs; 10-per-page list with Task, Status, Assigned by, Time, Schedule, Actions (Start/Stop + Submit). | StaffTasks, StaffEarlyStart |
| 14 | Sidebar: 18px extra space between the logo row and the menu. | Topbar |
| 13 | Removed the "On shift" status (sidebar, mobile Home, More) and the sidebar search button. ⌘K palette is optional. | Topbar, MHome, MMore |
| 12 | Instructions: no read receipts and no "Updated" tag. Read-before-start sheet kept (once per task, tracked internally only). | All task screens, TaskPanel |
| 11 | In review tasks keep Start/Stop and Submit; restarting moves the task back to In progress. Extension-pending tasks are not locked. | Staff screens, TaskPanel |
| 10 | Tasks page: List/Board switch replaced by an Export menu (Excel, CSV, PDF); board view removed. | Tasks |
| 9 | Task table: fixed columns so actions never wrap; Status on one line; Assignee one word per line, no initials; tabs moved below the toolbar. | Tasks |
| 8 | Pagination: 10 tasks per page on all task lists; date-range filter restored on all task lists. | Tasks, StaffHome, MTasks, MStaffHome |
| 7 | Desktop navigation: top bar replaced by a pinned black sidebar (scrolls independently; stacks above content below 900px). | All desktop pages |
| 6 | Staff running-task card trimmed: removed "Timer running", "by [manager]", "Timer started", "Started early"; smaller timer, buttons and instructions row. | StaffHome, StaffTasks, MStaffHome, MStaffTasks |
| 5 | Early-start prompt and clash warning; "Timer started early" history entry. | StaffTasks, MStaffTasks, StaffEarlyStart, TaskPanel |
| 4 | Every task shows scheduled Start and Deadline side by side. | All task screens |
| 3 | Instructions preview on cards; read-before-start sheet. | Task screens |
| 2 | Task panel with Details and History (timeline of every event). | TaskPanel, *TaskDetail |
| 1 | Role-based task actions: managers Edit/Delete; staff Start/Stop + Submit. Staff Home and My tasks screens added. | Task screens |
| 0 | New visual direction (stone, ink, yellow; Bricolage Grotesque + Geist) and full mobile set. | All |
