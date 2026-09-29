# Prompt A: Full architecture overview:
# Technical Overview

## 1. Framework & Stack

### Frontend
- **Framework:** React 18 (with TypeScript)
- **Build Tool:** Vite 5
- **Routing:** Wouter
- **State / Data Fetching:** TanStack React Query v5
- **Forms:** React Hook Form + Zod validation
- **UI Components:** shadcn/ui (Radix UI primitives) + Tailwind CSS
- **Animation:** Framer Motion
- **Charts:** Recharts
- **Tables:** TanStack Table
- **Icons:** Lucide React, React Icons
- **Drag & Drop:** @hello-pangea/dnd
- **PDF Generation:** jsPDF + jsPDF-AutoTable
- **Excel Export:** XLSX

### Backend
- **Runtime:** Node.js (v20) with TypeScript via `tsx`
- **Framework:** Express 4
- **Authentication:** Passport.js (Local Strategy) + express-session
- **Session Store:** MemoryStore (memorystore)
- **ORM:** Drizzle ORM
- **WebSocket:** `ws` library + Socket.IO (for video calls)
- **File Uploads:** Multer
- **Email:** Nodemailer (Gmail SMTP)
- **Push Notifications:** OneSignal

---

## 2. Frontend ↔ Backend Communication

The frontend and backend share the same port (5000). Vite proxies all requests in development; in production, Express serves the built static files.

### REST API
All data operations go through a RESTful JSON API mounted at `/api/*`. TanStack React Query handles fetching, caching, and cache invalidation on the frontend.

### Server-Sent Events (SSE)
`GET /api/notifications/stream` — a persistent SSE connection used to push real-time events to the frontend without polling. Events include: notifications, direct messages, team messages, general channel messages, review link updates, and team mentions.

### WebSocket (Application)
`/api/ws` — a raw `ws` WebSocket server used for real-time presence, heartbeat, and live chat updates.

### WebSocket (Video)
A separate Socket.IO server (`video-socket.ts`) handles WebRTC signalling for peer-to-peer video calls using `simple-peer`.

---

## 3. Folder Structure

```
/
├── client/                  # All frontend source code
│   └── src/
│       ├── App.tsx          # Root component, router, global SSE listener
│       ├── main.tsx         # React entry point
│       ├── index.css        # Global styles
│       ├── pages/           # Route-level page components
│       │   ├── auth-page.tsx
│       │   ├── dashboard/   # All dashboard sub-pages (projects, tasks, memos, chat, etc.)
│       │   ├── booking/
│       │   ├── video/
│       │   └── ...
│       ├── components/      # Shared/reusable UI components
│       │   ├── ui/          # shadcn base components (button, dialog, form, etc.)
│       │   ├── notifications/
│       │   └── ...
│       ├── hooks/           # Custom React hooks (useAuth, useToast, useOneSignal, etc.)
│       └── lib/             # Utilities (queryClient config, helper functions)
│
├── server/                  # All backend source code
│   ├── index.ts             # Express app entry point (startup, migration, server listen)
│   ├── auth.ts              # Passport setup, login/logout/register/password-reset endpoints
│   ├── routes.ts            # All /api/* route handlers (~12,000 lines)
│   ├── websocket.ts         # Raw ws WebSocket handler for real-time presence/chat
│   ├── video-socket.ts      # Socket.IO handler for WebRTC video signalling
│   ├── vite.ts              # Vite dev server middleware integration
│   ├── break-scheduler.ts   # Cron-like scheduler for automated staff break reminders
│   ├── communication-monitor.ts  # Background monitor for delayed response alerts
│   ├── onesignal.ts         # OneSignal push notification helper
│   └── services/
│       └── email.ts         # Nodemailer email service (Gmail SMTP)
│
├── db/                      # Database layer
│   ├── index.ts             # Drizzle client + postgres connection setup
│   └── schema.ts            # All table definitions and relations
│
├── migrations/              # Drizzle-generated SQL migration files (auto-applied on startup)
├── uploads/                 # Uploaded files (project resources, SOP attachments, etc.)
├── dist/                    # Production build output
├── attached_assets/         # Static assets attached during development
├── vite.config.ts           # Vite configuration
├── tailwind.config.ts       # Tailwind CSS configuration
├── theme.json               # shadcn theme (primary color, radius, appearance)
├── drizzle.config.ts        # Drizzle Kit configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies and scripts
```

---

## 4. Database

- **Engine:** PostgreSQL (hosted on Neon — a serverless Postgres provider)
- **ORM:** Drizzle ORM (`drizzle-orm/postgres-js`) with the `postgres` driver
- **Connection:** Configured via `DATABASE_URL` environment variable. Connection pool of up to 10 connections, 20-second idle timeout.
- **Migrations:** Managed by Drizzle Kit (`npm run db:push`). Migrations in the `./migrations` folder are automatically applied on every server start via `drizzle-orm/postgres-js/migrator`.

### Database Tables

| Table | Purpose |
|---|---|
| `users` | All user accounts (staff, managers, clients, interns, etc.) |
| `projects` | Project records with status, deadlines, and metadata |
| `project_members` | Many-to-many join between users and projects |
| `tasks` | Individual tasks within projects |
| `task_sessions` | Timer sessions tracking time spent on tasks |
| `task_iterations` | Revision/iteration history for tasks |
| `project_plans` | Project plans attached to projects |
| `deliverables` | Deliverable items within project plans |
| `project_messages` | Team chat messages scoped to a project |
| `direct_messages` | One-to-one private messages between users |
| `message_read_receipts` | Read receipt tracking for messages |
| `general_channel_messages` | Messages in the organisation-wide general channel |
| `general_channel_read_receipts` | Read receipts for the general channel |
| `notifications` | In-app notification records |
| `memos` | Organisational memos (general, individual, department types) |
| `memo_reads` | Tracks which users have read each memo |
| `memo_responses` | Responses submitted by memo recipients |
| `notes` | Personal notes created by users |
| `leave_applications` | Staff leave requests and their approval status |
| `bookings` | Booking/meeting records |
| `resources` | File/link resources attached to projects |
| `review_links` | Links submitted by project managers for team lead review |
| `project_briefings` | Project briefing documents |
| `client_invitations` | Invitation tokens sent to clients |
| `client_sentiment` | Weekly sentiment submissions from clients |
| `complaints` | Client complaint records |
| `staff_complaints` | Internal staff complaint records |
| `staff_queries` | Staff query/support requests |
| `technical_support_requests` | Technical support tickets |
| `deadline_extension_requests` | Requests to extend task or project deadlines |
| `issue_reports` | Bug/issue reports submitted by users |
| `performance` | Staff performance records |
| `sops` | Standard Operating Procedure documents |
| `sop_segments` | Individual segments/sections within SOPs |
| `stop_gap_allocations` | Temporary task allocation records |
| `stop_gap_task_assignments` | Assignments within stop-gap allocations |

---

## 5. Authentication

- **Method:** Session-based authentication using **Passport.js Local Strategy**
- **Password Hashing:** Node.js built-in `crypto.scrypt` with a random 16-byte salt. Stored as `hash.salt` (hex-encoded).
- **Session Storage:** In-memory store (`memorystore`) with a 24-hour expiry prune cycle and a 2-week cookie `maxAge`.
- **Cookie:** `connect.sid` — `httpOnly: true`, `sameSite: lax`. `secure: true` in production (Replit Deployment), `secure: false` in development.
- **Session Secret:** Read from `SESSION_SECRET` env var, with fallback to `REPL_ID` for Replit environments.

### Auth Flow
1. `POST /api/login` — Passport authenticates credentials, sets session cookie.
2. `GET /api/user` — Returns current user from session.
3. `POST /api/logout` — Destroys session, clears cookie, marks user as offline.
4. `POST /api/register` — Admin-only (operations managers/team leads). Creates user with `mustSetPassword: true` and sends setup email.
5. `POST /api/setup-password` — New user sets their password via a one-time token sent by email.
6. `POST /api/forgot-password` / `POST /api/reset-password` — Password reset via email token.
7. `GET /api/verify-email/:token` — Email verification.

### Role System
Users have a `role` field with the following values:
- `operations_manager` — Top-level admin; can send memos, manage all users.
- `team_lead` — Team leadership; reviews links, manages projects.
- `project_manager` (`main` or `supervisor` type)
- `product_owner`
- `staff` — Has a `specialization` field (e.g., developer, designer, etc.)
- `intern`
- `customer_support_officer`
- `client` — External client with a restricted view.

---

## 6. Third-Party APIs & Services

### OneSignal (Push Notifications)
- Used for cross-platform browser/mobile push notifications.
- Server-side: `server/onesignal.ts` sends notifications via the OneSignal REST API.
- Client-side: `react-onesignal` SDK initialises and registers the user's device with their user ID as the external ID.
- Triggered for: task assignments, memo delivery, review link events, and general notifications.

### Gmail via Nodemailer (Transactional Email)
- Used for: email verification, account setup links (new user onboarding), and password reset links.
- Transport: Gmail SMTP using an App Password.
- Falls back to Ethereal (mock SMTP) if Gmail credentials are not configured.

---

## 7. Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **Required** | PostgreSQL connection string (Neon). The server will not start without this. |
| `PRODUCTION_DATABASE_URL` | Optional | Separate production database URL. If not set, `DATABASE_URL` is used in all environments. |
| `SESSION_SECRET` | Recommended | Secret key used to sign session cookies. Falls back to `REPL_ID` if not set. |
| `REPL_ID` | Auto (Replit) | Injected by Replit. Used as a fallback session secret in development. |
| `REPLIT_DEPLOYMENT` | Auto (Replit) | Set to `"1"` by Replit when the app is running in a deployed (production) environment. Used to toggle secure cookies and environment detection. |
| `NODE_ENV` | Optional | Standard Node environment flag (`production`/`development`). Used alongside `REPLIT_DEPLOYMENT` for environment detection. |
| `ONESIGNAL_APP_ID` | Optional | OneSignal application ID for the push notification service. |
| `ONESIGNAL_REST_API_KEY` | Optional | OneSignal REST API key used server-side to send push notifications. |
| `VITE_ONESIGNAL_APP_ID` | Optional | OneSignal App ID exposed to the frontend (must be prefixed with `VITE_` for Vite to include it in the browser bundle). |
| `GMAIL_USER` | Optional | Gmail address used as the SMTP sender for transactional emails. |
| `GMAIL_APP_PASSWORD` | Optional | Gmail App Password for SMTP authentication. If absent, email falls back to Ethereal mock transport. |

---

# Prompt B: Features & Pages

## Authentication Pages

### /auth — Login/Reset Password
- **Description:** Main login page with username/password authentication. Also includes forgot password and password reset flows.
- **Actions:** Login, initiate password reset, set new password
- **Data Read:** User credentials validation
- **Data Write:** User login session, password reset tokens
- **API Endpoints:** `POST /api/login`, `POST /api/forgot-password`, `POST /api/reset-password`

### /setup-password — Initial Password Setup
- **Description:** One-time password setup page for newly created accounts. Accessed via email link.
- **Actions:** Set initial password with token
- **Data Read:** Setup token from URL
- **Data Write:** User password
- **API Endpoints:** `POST /api/setup-password`

### /reset-password — Password Reset
- **Description:** Dedicated password reset page with token validation
- **Actions:** Reset forgotten password
- **Data Read:** Reset token from URL
- **Data Write:** User password
- **API Endpoints:** `POST /api/reset-password`

### /all-users — Public User Directory
- **Description:** Lists all active users in the system with their roles and contact info
- **Actions:** View user profiles, filter by role
- **Data Read:** All users
- **Data Write:** None
- **API Endpoints:** `GET /api/public/users`

---

## Dashboard Pages

### /dashboard — Main Dashboard
- **Description:** Role-based dashboard. Staff/managers see project overview, clients see client dashboard.
- **Actions:** View key metrics, recent projects, tasks, notifications
- **Data Read:** User profile, projects, tasks, notifications based on role
- **Data Write:** None
- **API Endpoints:** `GET /api/user`, `GET /api/projects`, `GET /api/tasks`, `GET /api/notifications`

### /dashboard/projects — Projects List
- **Description:** Shows all projects the user is a member of or managing
- **Actions:** View projects, create new project, filter by status
- **Data Read:** Projects list with member count, status, deadlines
- **Data Write:** Create new project
- **API Endpoints:** `GET /api/projects`, `POST /api/projects`

### /dashboard/projects/:id — Project Details
- **Description:** Detailed project view with members, tasks, plans, and resources
- **Actions:** View/edit project info, manage team members, view deliverables and resources
- **Data Read:** Project details, project members, deliverables, resources, activity
- **Data Write:** Edit project info, complete project
- **API Endpoints:** `GET /api/projects/:id`, `GET /api/projects/:id/members`, `GET /api/projects/:id/plans`, `GET /api/projects/:id/resources`, `PUT /api/projects/:id`, `POST /api/projects/:id/complete`

### /dashboard/projects/:id/tasks — Project Tasks
- **Description:** List and manage all tasks within a project
- **Actions:** View tasks, assign tasks, start/stop timer, submit completed tasks
- **Data Read:** Project tasks with status, assignments, time tracking
- **Data Write:** Task assignments, timer sessions, task submissions
- **API Endpoints:** `GET /api/projects/:id/tasks`, `POST /api/tasks`, `POST /api/tasks/:id/start-timer`, `POST /api/tasks/:id/stop-timer`, `POST /api/tasks/:id/submit`

### /dashboard/projects/:id/team-chat — Team Chat
- **Description:** Real-time messaging for project team members
- **Actions:** Send messages, view message history, mentions, reactions
- **Data Read:** Project messages, user profiles
- **Data Write:** New messages, read receipts
- **API Endpoints:** `GET /api/projects/:projectId/team-messages`, `POST /api/projects/:projectId/team-messages`, `PUT /api/projects/:projectId/team-messages/mark-read`, `PUT /api/projects/:projectId/team-messages/:messageId`

### /dashboard/projects/:id/client-chat — Client Chat
- **Description:** Separate chat channel for client communication within the project
- **Actions:** Send messages to clients, view client responses
- **Data Read:** Client messages, project info
- **Data Write:** New client messages, read receipts
- **API Endpoints:** `GET /api/projects/:projectId/team-messages` (filtered), `POST /api/projects/:projectId/team-messages`

### /dashboard/projects/:id/staff-tasks — Staff Tasks in Project
- **Description:** Tasks assigned to the logged-in staff member within a specific project
- **Actions:** View personal project tasks, update status, track time
- **Data Read:** Staff's project tasks, time tracking
- **Data Write:** Task status, timer sessions
- **API Endpoints:** `GET /api/projects/:id/tasks` (filtered), `POST /api/tasks/:id/start-timer`, `POST /api/tasks/:id/stop-timer`

### /dashboard/projects/:id/resources — Project Resources
- **Description:** Manages files and external links related to the project
- **Actions:** Upload/attach files, add resource links, download resources
- **Data Read:** Project resources
- **Data Write:** New files/links
- **API Endpoints:** `GET /api/projects/:id/resources`, `POST /api/projects/:id/resources/upload`, `POST /api/projects/:id/resources/link`, `PUT /api/projects/:projectId/resources/:id`, `DELETE /api/projects/:projectId/resources/:id`

### /dashboard/tasks — All Tasks
- **Description:** Comprehensive view of all tasks assigned to the user across all projects
- **Actions:** Filter tasks, view details, manage assignments, timer control
- **Data Read:** All user tasks with status, projects, assignees
- **Data Write:** Task updates, timer sessions
- **API Endpoints:** `GET /api/tasks`, `PUT /api/tasks/:id`, `PUT /api/tasks/:id/status`, `POST /api/tasks/:id/start-timer`, `POST /api/tasks/:id/stop-timer`, `POST /api/tasks/:id/reassign`

---

## Leave & Time Off

### /dashboard/leave-application — Apply for Leave
- **Description:** Staff submit leave/time-off requests with dates and reason
- **Actions:** Create leave application, select date range, specify reason/type
- **Data Read:** User info, approved leave types
- **Data Write:** New leave application
- **API Endpoints:** `POST /api/leave-applications`

### /dashboard/leave-management — Review Leave Requests
- **Description:** Managers/approvers review and approve/reject leave applications
- **Actions:** View pending requests, approve/reject, add comments
- **Data Read:** All leave applications, applicant info
- **Data Write:** Leave approval status, comments
- **API Endpoints:** `GET /api/leave-applications/all`, `PUT /api/leave-applications/:id/review`

---

## Communication

### /dashboard/direct-messages — Direct Messages
- **Description:** One-to-one private messaging between users
- **Actions:** Start conversations, send messages, view message history, mark as read
- **Data Read:** Conversations, message threads, unread counts
- **Data Write:** New messages, read receipts
- **API Endpoints:** `GET /api/direct-messages/conversations`, `GET /api/direct-messages/:userId`, `PUT /api/direct-messages/:userId/read`, `DELETE /api/direct-messages/:messageId`, `GET /api/direct-messages/has-updates`, `GET /api/direct-messages/:messageId/read-count`, `GET /api/direct-messages/unread-count`

### /dashboard/general-channel — General Channel
- **Description:** Organisation-wide communication channel accessible to all staff
- **Actions:** Send messages, view channel history, mention users
- **Data Read:** All general channel messages
- **Data Write:** New messages, read status
- **API Endpoints:** `GET /api/general-channel/messages`, `POST /api/general-channel/messages`, `GET /api/general-channel/unread-count`, `PUT /api/general-channel/messages/:id`, `DELETE /api/general-channel/messages/:messageId`, `DELETE /api/general-channel/messages/:messageId/pin`, `GET /api/general-channel/messages/:messageId/read-count`

---

## Memos & Notes

### /dashboard/memos — Memos
- **Description:** Organisation-wide memo system. Managers send memos (general/individual/department), staff receive and respond.
- **Actions:** Create memos (managers), view memos, respond to memos (one response per user), mark as read, view reader list and response count
- **Data Read:** Memos targeted to user, read status, responses, sender names, response count
- **Data Write:** Create memos, mark memos read, submit responses
- **API Endpoints:** `GET /api/memos`, `GET /api/memos/my-memos`, `POST /api/memos`, `POST /api/memos/:id/mark-read`, `GET /api/memos/:id/responses`, `POST /api/memos/:id/responses`, `DELETE /api/memos/:id`

### /dashboard/notes — Personal Notes
- **Description:** Private note-taking for individual users
- **Actions:** Create notes, edit notes, delete notes, organize by date
- **Data Read:** User's notes
- **Data Write:** Create/update/delete notes
- **API Endpoints:** `GET /api/notes`, `POST /api/notes`, `PUT /api/notes/:id`, `DELETE /api/notes/:id`

---

## Support & Issue Management

### /dashboard/technical-support — Technical Support Requests
- **Description:** Users submit and track technical support issues/requests
- **Actions:** Create support request, view status, view response history
- **Data Read:** User's support requests, responses
- **Data Write:** New support requests
- **API Endpoints:** `POST /api/technical-support/requests`

### /dashboard/technical-management — Manage Support Requests
- **Description:** Admin/support team reviews and manages incoming technical support requests
- **Actions:** View all requests, assign to staff, update status, add responses
- **Data Read:** All support requests, assignment status
- **Data Write:** Assign requests, update status, add responses
- **API Endpoints:** `GET /api/technical-support/requests`, `POST /api/technical-support/requests/:id/assign`, `PUT /api/technical-support/requests/:id`

### /dashboard/report-issues — Report Issues/Bugs
- **Description:** Users report bugs and technical issues with the application
- **Actions:** Create issue report, add description and screenshots
- **Data Read:** None
- **Data Write:** New issue report
- **API Endpoints:** `POST /api/issue-reports`

### /dashboard/report-management — Issue Report Management
- **Description:** Admins view and manage reported issues
- **Actions:** Review reports, update status, add comments
- **Data Read:** All issue reports
- **Data Write:** Update report status
- **API Endpoints:** `GET /api/issue-reports`, `PUT /api/issue-reports/:id`

---

## Complaints & Feedback

### /dashboard/staff-complaints — Staff Complaints
- **Description:** Internal complaints and concerns from staff
- **Actions:** View complaint categories, submit complaints, track status
- **Data Read:** Staff's complaints
- **Data Write:** New complaints
- **API Endpoints:** `GET /api/staff-complaints/my-complaints`, `POST /api/staff-complaints`, `POST /api/staff-complaints/mark-viewed`

### /dashboard/complaints-management — Manage Complaints
- **Description:** Admins review and resolve staff and client complaints
- **Actions:** View all complaints, categorize, resolve, communicate with complainants
- **Data Read:** All complaints, resolution status
- **Data Write:** Update complaint status
- **API Endpoints:** `GET /api/complaints`, `GET /api/staff-complaints`, `PUT /api/complaints/:id`

### /dashboard/client-complaints — Client Complaints (Admin View)
- **Description:** Administrative view of client complaints
- **Actions:** View, categorize, and manage client complaints
- **Data Read:** All client complaints
- **Data Write:** Update complaint status
- **API Endpoints:** `GET /api/complaints`

### /dashboard/send-complaint — Send Complaint (Staff)
- **Description:** Simple form for staff to file a complaint
- **Actions:** Submit complaint with title and description
- **Data Read:** None
- **Data Write:** New complaint
- **API Endpoints:** `POST /api/staff-complaints`

---

## Client Management

### /dashboard/client-management — Manage Clients
- **Description:** View and manage all client accounts, onboarding status, and contacts
- **Actions:** View client list, update onboarding status, view client details
- **Data Read:** All clients, onboarding status
- **Data Write:** Update client onboarding
- **API Endpoints:** `GET /api/clients/management`, `PUT /api/clients/:id/onboarding-status`, `GET /api/clients/has-new`

### /dashboard/client-accounts — Client Accounts
- **Description:** Detailed client account information and history
- **Actions:** View account details, contact info, project history
- **Data Read:** Client accounts data
- **Data Write:** None
- **API Endpoints:** `GET /api/client-accounts`

### /dashboard/client-sentiment — Client Sentiment
- **Description:** Submit weekly satisfaction/sentiment feedback on client relationships
- **Actions:** Submit weekly sentiment score, add comments
- **Data Read:** Previous submissions, prompts
- **Data Write:** New sentiment submission
- **API Endpoints:** `GET /api/client-sentiment/current-week`, `POST /api/client-sentiment`

### /dashboard/client-sentiment-tracker — Sentiment Tracking
- **Description:** View historical sentiment data for all clients
- **Actions:** View sentiment trends, export data
- **Data Read:** Historical sentiment data
- **Data Write:** None
- **API Endpoints:** `GET /api/client-sentiment/all`, `GET /api/client-sentiment/needs-weekly-submission`, `GET /api/client-sentiment/has-new`

---

## Deadlines & Extensions

### /dashboard/deadline-extension-requests — Manage Extensions
- **Description:** Managers review and approve deadline extension requests from staff
- **Actions:** View requests, approve/reject with feedback
- **Data Read:** All extension requests, reasons
- **Data Write:** Approve/reject requests
- **API Endpoints:** `GET /api/deadline-extension-requests`, `PUT /api/deadline-extension-requests/:id`

### /dashboard/extension-requests — Request Extension
- **Description:** Staff request deadline extensions for tasks or projects
- **Actions:** Create extension request, provide justification
- **Data Read:** User's tasks/projects with deadlines
- **Data Write:** New extension request
- **API Endpoints:** `POST /api/deadline-extension-requests`

---

## Operations & Planning

### /dashboard/staff-report — Staff Reports
- **Description:** View performance and activity reports for staff members
- **Actions:** View reports, filter by date/staff member
- **Data Read:** Staff performance data, task completions, time tracking
- **Data Write:** None
- **API Endpoints:** `GET /api/staff`

### /dashboard/productivity — Productivity Metrics
- **Description:** View personal or team productivity metrics and KPIs
- **Actions:** View charts, export data, compare periods
- **Data Read:** Productivity data, task metrics, time tracking
- **Data Write:** None
- **API Endpoints:** `GET /api/productivity`, `GET /api/kpi-report/productivity`

### /dashboard/kpi-report — KPI Report
- **Description:** Detailed KPI (Key Performance Indicator) reports for organisation
- **Actions:** View KPIs, filter by department/time period
- **Data Read:** KPI data
- **Data Write:** None
- **API Endpoints:** `GET /api/kpi-report/productivity`

### /dashboard/communication-tracker — Communication Tracker
- **Description:** Monitor response times and communication delays
- **Actions:** View delayed messages, track communication health
- **Data Read:** Message response times
- **Data Write:** None
- **API Endpoints:** Internal communication data

---

## Documents & Resources

### /dashboard/sop — Standard Operating Procedures
- **Description:** View and manage SOPs (Standard Operating Procedures)
- **Actions:** Browse SOP library, search, view detailed SOP content, upload new SOPs
- **Data Read:** SOPs, segments, categories
- **Data Write:** Create/upload new SOPs
- **API Endpoints:** `GET /api/sops`, `GET /api/sops/departments`, `POST /api/sops`, `PUT /api/sops/:id`, `DELETE /api/sops/:id`, `POST /api/sops/upload-file`

### /dashboard/project-briefing — Project Briefings
- **Description:** Create and manage project briefing documents
- **Actions:** Create briefings, edit, view briefing history
- **Data Read:** Project briefings
- **Data Write:** Create/update briefings
- **API Endpoints:** `GET /api/project-briefings`, `POST /api/project-briefings`, `PUT /api/project-briefings/:id`, `DELETE /api/project-briefings/:id`

---

## Review & Approval

### /dashboard/review-links — Review Links
- **Description:** Project managers submit links for team lead review; team leads review and approve/request revisions
- **Actions:** Submit links for review (PM), review links and approve/request revisions (TL)
- **Data Read:** Submitted review links, status, comments
- **Data Write:** Submit links, approve/request changes, add feedback
- **API Endpoints:** `GET /api/review-links`, `POST /api/review-links`, `PUT /api/review-links/:id/reviewed`, `PUT /api/review-links/:id/not-approved`, `PUT /api/review-links/:id/comment`, `DELETE /api/review-links/:id`, `GET /api/review-links/has-unreviewed`

---

## Administrative

### /dashboard/user-control — User Control
- **Description:** Admins manage user accounts, roles, and statuses
- **Actions:** Activate/deactivate users, change roles, view user info
- **Data Read:** All users, roles, status
- **Data Write:** Update user status
- **API Endpoints:** `POST /api/user-control/:userId/status`

### /dashboard/profile — User Profile
- **Description:** View and edit personal profile information
- **Actions:** Update name, email, profile picture, preferences
- **Data Read:** User profile data
- **Data Write:** Update profile
- **API Endpoints:** `GET /api/user`, `PUT /api/users/status`

### /dashboard/guide-videos — Guide Videos
- **Description:** Training and instructional videos for using the platform
- **Actions:** Browse videos, watch, rate
- **Data Read:** Video library
- **Data Write:** None
- **API Endpoints:** None (static content)

---

## Additional Pages

### /dashboard/bookings — Bookings/Meetings
- **Description:** Create and manage meeting bookings and reservations
- **Actions:** Create bookings, view calendar, mark as attended
- **Data Read:** Bookings, user availability
- **Data Write:** Create/update bookings
- **API Endpoints:** `GET /api/bookings`, `GET /api/bookings/my-upcoming`, `POST /api/bookings`, `PUT /api/bookings/:id`, `DELETE /api/bookings/:id`

### /dashboard/staff-queries — Staff Queries/Support
- **Description:** Staff members submit queries or questions to the support team
- **Actions:** Submit query, track response
- **Data Read:** User's queries
- **Data Write:** New query
- **API Endpoints:** `POST /api/staff-queries`

### /dashboard/register-dissatisfaction — Register Dissatisfaction
- **Description:** Clients register dissatisfaction with services
- **Actions:** Submit dissatisfaction report
- **Data Read:** Previous reports
- **Data Write:** New dissatisfaction entry
- **API Endpoints:** Internal

### /dashboard/emergency-support — Emergency Support
- **Description:** Request urgent support for critical issues
- **Actions:** Submit emergency support request
- **Data Read:** None
- **Data Write:** Emergency request
- **API Endpoints:** Internal

### /dashboard/rate-us — Rate Us
- **Description:** Clients provide ratings and feedback on services
- **Actions:** Rate services, leave comments
- **Data Read:** None
- **Data Write:** Rating submission
- **API Endpoints:** Internal

### /dashboard/reach-us — Reach Us/Contact
- **Description:** Contact information and alternative ways to reach support
- **Actions:** View contact info, links to support channels
- **Data Read:** Contact info
- **Data Write:** None
- **API Endpoints:** None

### /dashboard/support-policy — Support Policy
- **Description:** View support policies and terms
- **Actions:** Read policy information
- **Data Read:** Policy content
- **Data Write:** None
- **API Endpoints:** None

---

# Prompt C: Data Models & Database Schema

## All Database Tables

### users
**Description:** Core user account records for all system users (staff, managers, clients, interns).

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `username` | text | Unique, Required | Username for login |
| `password` | text | Required | Scrypt hashed with salt format: `hash.salt` |
| `name` | text | Required | User's full name |
| `email` | text | Required | Email address |
| `role` | enum | Required, One of: `client`, `project_manager`, `staff`, `intern`, `customer_support_officer`, `operations_manager`, `team_lead` | Determines system permissions |
| `gender` | text | Optional | `male` or `female` |
| `specialization` | enum | Optional | Department specialization (e.g., `development`, `design`, `automation`, etc.) |
| `projectManagerType` | enum | Optional | `main` or `supervisor` (only for project managers) |
| `status` | enum | Default: `offline` | `online`, `offline`, `idle` |
| `workStatus` | enum | Default: `active` | `active`, `on_break`, `absent` |
| `breakStartTime` | timestamp | Optional | When user's break started |
| `breakCount` | integer | Default: 0 | Number of breaks taken |
| `absenceReason` | enum | Default: `not_applicable` | `leave`, `off_day`, `not_applicable` |
| `absenceEndDate` | timestamp | Optional | When absence ends |
| `breakOneTime` | text | Optional | Daily break time in "HH:mm" format |
| `currentTaskId` | integer | Optional FK to tasks | Currently active task |
| `taskStartTime` | timestamp | Optional | When current task started |
| `emailVerified` | boolean | Default: false | Email verification status |
| `verificationToken` | text | Optional | Email verification token |
| `resetPasswordToken` | text | Optional | Password reset token |
| `resetPasswordExpires` | timestamp | Optional | Password reset token expiration |
| `onboardingStatus` | enum | Default: `not_onboarded` | `onboarded`, `not_onboarded`, `onboarding_in_progress`, `onboarding_pending` |
| `productService` | enum | Optional | Client product/service type |
| `clientType` | enum | Optional | `project_client` or `support_maintenance_client` |
| `mustSetPassword` | boolean | Default: false | Flag for first-time password setup |
| `passwordSetupToken` | text | Optional | One-time token for initial password setup |
| `lastActive` | timestamp | Default: now | Last activity timestamp |
| `lastSeen` | timestamp | Default: now | Last seen timestamp |
| `createdAt` | timestamp | Default: now | Account creation date |
| `isActive` | boolean | Default: true | Soft-delete flag |

**Relationships:**
- `one` — currentTask: `tasks`
- `many` — projects (as client)
- `many` — projects (as manager)
- `many` — tasks (as assignee)
- `many` — notifications
- `many` — project members
- `many` — messages

---

### projects
**Description:** Project records managed by project managers with client associations.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `name` | text | Required | Project name |
| `description` | text | Optional | Project description |
| `type` | enum | Required | `web_development`, `mobile_app`, `digital_marketing`, `ui_ux_design`, `content_creation`, `automation`, `social_media` |
| `category` | enum | Optional | `website_development`, `dpl_outright`, `dpl_partnership`, `direct_marketing`, `support_maintenance` |
| `status` | enum | Default: `pending` | `active`, `inactive`, `pending` |
| `clientId` | integer | Optional FK to users | Associated client |
| `pendingClientEmail` | text | Optional | Email of client not yet in system |
| `managerId` | integer | Required FK to users | Project manager |
| `progress` | integer | Default: 0 | Progress percentage (0-100) |
| `startDate` | timestamp | Optional | Project start date |
| `endDate` | timestamp | Optional | Project end date |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Relationships:**
- `one` — client: `users` (clientId)
- `one` — manager: `users` (managerId)
- `many` — tasks
- `many` — members: `projectMembers`
- `many` — messages
- `many` — clientInvitations

---

### projectMembers
**Description:** Join table linking users to projects with roles and invitation status.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `projectId` | integer | FK to projects | Project reference |
| `userId` | integer | FK to users | User reference |
| `role` | enum | Default: `member` | `viewer`, `member`, `admin`, `technical_support` |
| `invitationStatus` | enum | Default: `pending` | `pending`, `accepted`, `declined` |
| `invitedBy` | integer | Optional FK to users | User who sent invitation |
| `invitedAt` | timestamp | Default: now | Invitation date |
| `joinedAt` | timestamp | Optional | When user accepted invitation |

**Relationships:**
- `one` — project: `projects`
- `one` — user: `users`
- `one` — inviter: `users` (invitedBy)

---

### tasks
**Description:** Individual tasks within projects with time tracking and status management.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `title` | text | Required | Task title |
| `description` | text | Optional | Task description |
| `projectId` | integer | Optional FK to projects | Associated project |
| `assigneeId` | integer | Optional FK to users | Assigned to user |
| `assignedBy` | integer | Optional FK to users | User who assigned task |
| `status` | enum | Default: `todo` | `todo`, `in_progress`, `completed`, `review`, `technical_support`, `pending`, `not_approved`, `on_hold` |
| `iterationNumber` | integer | Default: 1 | Current iteration/revision |
| `priority` | enum | Default: `medium` | `low`, `medium`, `high` |
| `progress` | integer | Default: 0 | Progress percentage (0-100) |
| `startDate` | timestamp | Optional | Expected start date |
| `deadline` | timestamp | Optional | Task deadline |
| `workingHours` | integer | Default: 0 | Allocated hours |
| `workingMinutes` | integer | Default: 0 | Allocated minutes |
| `timeSpent` | integer | Default: 0 | Total time spent in seconds |
| `isTimerRunning` | boolean | Default: false | Timer state |
| `timerStartTime` | timestamp | Optional | When current timer started |
| `hasBeenStarted` | boolean | Default: false | Whether task work has begun |
| `actualStartTime` | timestamp | Optional | When work actually started |
| `reviewStartedAt` | timestamp | Optional | When task entered review status |
| `completedAt` | timestamp | Optional | When task was completed |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Relationships:**
- `one` — project: `projects`
- `one` — assignee: `users`
- `one` — assigner: `users` (assignedBy)
- `many` — sessions: `taskSessions`
- `many` — iterations: `taskIterations`

---

### taskSessions
**Description:** Time tracking sessions for individual work on tasks.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `taskId` | integer | Required FK to tasks (cascade delete) | Task reference |
| `userId` | integer | Required FK to users | User working on task |
| `startTime` | timestamp | Required | Session start time |
| `endTime` | timestamp | Optional | Session end time |
| `duration` | integer | Optional | Duration in seconds (calculated when session ends) |
| `createdAt` | timestamp | Default: now | Creation date |

**Relationships:**
- `one` — task: `tasks`
- `one` — user: `users`

---

### taskIterations
**Description:** Revision/iteration history for tasks with assignment changes.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `taskId` | integer | Required FK to tasks (cascade delete) | Task reference |
| `iterationNumber` | integer | Required | Iteration number |
| `assigneeId` | integer | Optional FK to users | Assigned to user |
| `assignedBy` | integer | Optional FK to users | User who assigned |
| `description` | text | Optional | Iteration description/feedback |
| `status` | enum | Optional | Same as task statuses |
| `startDate` | timestamp | Optional | Iteration start date |
| `deadline` | timestamp | Optional | Iteration deadline |
| `workingHours` | integer | Default: 0 | Hours allocated |
| `workingMinutes` | integer | Default: 0 | Minutes allocated |
| `timeSpent` | integer | Default: 0 | Time spent in seconds |
| `notes` | text | Optional | Revision notes |
| `reassignedBy` | integer | Optional FK to users | User who reassigned |
| `createdAt` | timestamp | Default: now | Creation date |
| `completedAt` | timestamp | Optional | Completion date |

**Relationships:**
- `one` — task: `tasks`
- `one` — assignee: `users`
- `one` — assigner: `users`

---

### projectPlans
**Description:** Project planning documents with deliverables and milestones.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `projectId` | integer | Required FK to projects | Project reference |
| `name` | text | Required | Plan name |
| `description` | text | Optional | Plan description |
| `startDate` | timestamp | Optional | Plan start date |
| `endDate` | timestamp | Optional | Plan end date |
| `status` | enum | Default: `draft` | `draft`, `active`, `completed`, `on_hold` |
| `createdBy` | integer | Required FK to users | Plan creator |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Relationships:**
- `one` — project: `projects`
- `one` — creator: `users`
- `many` — deliverables: `deliverables`

---

### deliverables
**Description:** Deliverable items within project plans with status tracking.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `projectPlanId` | integer | Required FK to projectPlans | Plan reference |
| `name` | text | Required | Deliverable name |
| `description` | text | Optional | Deliverable description |
| `startDate` | timestamp | Required | Start date |
| `endDate` | timestamp | Required | End date |
| `duration` | integer | Optional | Duration in days |
| `status` | enum | Default: `pending` | `pending`, `in_progress`, `completed`, `overdue` |
| `order` | integer | Default: 0 | Display order |
| `dependencies` | jsonb | Optional | Array of deliverable IDs this depends on |
| `assigneeId` | integer | Optional FK to users | Assigned to user |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Relationships:**
- `one` — projectPlan: `projectPlans`
- `one` — assignee: `users`

---

### directMessages
**Description:** One-to-one private messages between users.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `senderId` | integer | Required FK to users | Message sender |
| `receiverId` | integer | Required FK to users | Message receiver |
| `content` | text | Required | Message content |
| `read` | boolean | Default: false, Required | Read status |
| `createdAt` | timestamp | Default: now, Required | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Relationships:**
- `one` — sender: `users`
- `one` — receiver: `users`

---

### projectMessages
**Description:** Team chat messages scoped to a project.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `projectId` | integer | Required FK to projects | Project reference |
| `senderId` | integer | Required FK to users | Message sender |
| `content` | text | Required | Message content |
| `createdAt` | timestamp | Default: now, Required | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |
| `isEdited` | boolean | Default: false | Indicates if message was edited |

**Relationships:**
- `one` — project: `projects`
- `one` — sender: `users`
- `many` — readReceipts: `messageReadReceipts`

---

### messageReadReceipts
**Description:** Read receipt tracking for project messages.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `messageId` | integer | Required FK to projectMessages (cascade delete) | Message reference |
| `userId` | integer | Required FK to users (cascade delete) | User who read |
| `readAt` | timestamp | Default: now | When message was read |

**Relationships:**
- `one` — message: `projectMessages`
- `one` — user: `users`

---

### generalChannelMessages
**Description:** Organisation-wide channel messages accessible to all staff.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `content` | text | Required | Message content |
| `senderId` | integer | Required FK to users (cascade delete) | Message sender |
| `createdAt` | timestamp | Default: now, Required | Creation date |
| `updatedAt` | timestamp | Optional | Last update date |
| `isEdited` | boolean | Default: false | Whether message was edited |
| `isPinned` | boolean | Default: false | Whether message is pinned |
| `reactions` | jsonb | Default: [] | Array of reactions with emoji and userIds |

**Relationships:**
- `one` — sender: `users`
- `many` — readReceipts: `generalChannelReadReceipts`

---

### generalChannelReadReceipts
**Description:** Read receipt tracking for general channel messages.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `messageId` | integer | Required FK to generalChannelMessages (cascade delete) | Message reference |
| `userId` | integer | Required FK to users (cascade delete) | User who read |
| `readAt` | timestamp | Default: now, Required | When message was read |

**Relationships:**
- `one` — message: `generalChannelMessages`
- `one` — user: `users`

---

### notifications
**Description:** In-app notification records for system events.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `userId` | integer | Required FK to users | Notification recipient |
| `type` | enum | Required | `task_assigned`, `task_updated`, `task_completed`, `mention`, `team_mention`, `technical_support_request`, `communication_warning`, `communication_query_discarded`, `break_reminder`, `deadline_reminder`, `project_updated`, `memo_received`, `review_link_assigned`, `review_link_reviewed`, `review_link_comment` |
| `content` | text | Required | Notification message |
| `referenceId` | integer | Optional | ID of referenced entity |
| `referenceType` | enum | Optional | `task`, `project`, `message`, `technical_support_request`, `complaint`, `communication_delay`, `memo`, `review_link` |
| `read` | boolean | Default: false | Read status |
| `createdAt` | timestamp | Default: now | Creation date |

**Relationships:**
- `one` — user: `users`

---

### memos
**Description:** Organisation-wide memos sent by managers to staff with flexible recipient targeting.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `title` | text | Required | Memo title |
| `content` | text | Required | Memo content |
| `type` | enum | Required | `individual`, `general`, `department` |
| `recipients` | jsonb | Required | Array of user IDs or department names (e.g., ["all_staff", "development", 42, 51]) |
| `sentBy` | integer | Required FK to users | Memo sender |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Relationships:**
- `one` — sender: `users`
- `many` — reads: `memoReads`

---

### memoReads
**Description:** Tracks which users have read each memo.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `memoId` | integer | Required FK to memos (cascade delete) | Memo reference |
| `userId` | integer | Required FK to users (cascade delete) | User who read |
| `readAt` | timestamp | Default: now | When memo was read |

**Relationships:**
- `one` — memo: `memos`
- `one` — user: `users`

---

### memoResponses
**Description:** Responses submitted by memo recipients (one response per user per memo).

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `memoId` | integer | Required FK to memos (cascade delete) | Memo reference |
| `userId` | integer | Required FK to users (cascade delete) | Respondent user |
| `content` | text | Required | Response content |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Validation Rules:**
- Each user can only submit one response per memo (enforced in backend)

**Relationships:**
- `one` — memo: `memos`
- `one` — user: `users`

---

### notes
**Description:** Personal notes created and managed by users.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `title` | text | Optional | Note title |
| `content` | text | Required | Note content |
| `type` | enum | Default: `freetext` | `freetext` or `todo` |
| `todoItems` | jsonb | Optional | Array of todo items: `[{id: string, text: string, completed: boolean}]` |
| `userId` | integer | Required FK to users (cascade delete) | Note owner |
| `createdBy` | integer | Required FK to users (cascade delete) | User who created |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |
| `category` | text | Default: `general` | Note category |

**Relationships:**
- `one` — user: `users`

---

### leaveApplications
**Description:** Staff leave and time-off requests with approval workflow.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `userId` | integer | Required FK to users | Leave applicant |
| `leaveType` | enum | Required | `day_off` or `leave_of_absence` |
| `reason` | text | Required | Reason for leave |
| `startDate` | timestamp | Required | Leave start date |
| `endDate` | timestamp | Required | Leave end date |
| `totalDays` | integer | Required | Total days of leave |
| `proofImageUrl` | text | Optional | Proof document/image URL |
| `status` | enum | Default: `pending` | `pending`, `approved`, `rejected` |
| `appliedAt` | timestamp | Default: now | Application date |
| `reviewedAt` | timestamp | Optional | When application was reviewed |
| `reviewedBy` | integer | Optional FK to users | User who reviewed |
| `reviewComments` | text | Optional | Reviewer comments |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Relationships:**
- `one` — user: `users`
- `one` — reviewer: `users` (reviewedBy)

---

### bookings
**Description:** Meeting and event bookings/reservations.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `title` | text | Required | Booking title |
| `description` | text | Optional | Booking description |
| `type` | enum | Required | `one_on_one`, `team_booking`, `marketing_meeting`, `general_booking` |
| `scheduledBy` | integer | Required FK to users | User who scheduled |
| `participants` | jsonb | Required | Array of user IDs participating |
| `startTime` | timestamp | Required | Booking start time |
| `endTime` | timestamp | Required | Booking end time |
| `status` | enum | Default: `scheduled` | `scheduled`, `completed`, `cancelled` |
| `meetingLink` | text | Optional | Video conference link |
| `notes` | text | Optional | Additional notes |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Relationships:**
- `one` — scheduler: `users`

---

### resources
**Description:** Files and external links attached to projects.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `name` | text | Required | Resource name |
| `type` | text | Required | File MIME type or resource type |
| `size` | integer | Optional | File size in bytes |
| `path` | text | Optional | Server file path |
| `link` | text | Optional | External resource link |
| `projectId` | integer | Optional FK to projects | Associated project |
| `uploadedBy` | integer | Optional FK to users | User who uploaded |
| `createdAt` | timestamp | Default: now | Creation date |

---

### technicalSupportRequests
**Description:** Technical support tickets submitted and managed by support team.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `title` | text | Required | Request title |
| `description` | text | Required | Request description |
| `taskId` | integer | Optional FK to tasks | Related task |
| `requesterId` | integer | Required FK to users | User requesting support |
| `assignedToId` | integer | Optional FK to users | Support staff assigned |
| `status` | enum | Default: `pending` | `pending`, `in_progress`, `resolved`, `closed` |
| `priority` | enum | Default: `medium` | `low`, `medium`, `high`, `urgent` |
| `resolution` | text | Optional | Resolution details |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |
| `resolvedAt` | timestamp | Optional | When request was resolved |

**Relationships:**
- `one` — requester: `users`
- `one` — assignedTo: `users`
- `one` — task: `tasks`

---

### deadlineExtensionRequests
**Description:** Requests from staff to extend task or project deadlines.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `taskId` | integer | Required FK to tasks | Task to extend |
| `requesterId` | integer | Required FK to users | User requesting extension |
| `projectManagerId` | integer | Required FK to users | Project manager to approve |
| `reason` | text | Required | Reason for extension |
| `requestedDeadline` | timestamp | Optional | Requested new deadline |
| `status` | enum | Default: `pending` | `pending`, `approved`, `declined` |
| `decisionReason` | text | Optional | Reason for decision |
| `decidedBy` | integer | Optional FK to users | User who decided |
| `decidedAt` | timestamp | Optional | When decision was made |
| `approvedDeadline` | timestamp | Optional | Approved new deadline |
| `approvedWorkingHours` | integer | Optional | Approved additional hours |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Relationships:**
- `one` — task: `tasks`
- `one` — requester: `users`
- `one` — projectManager: `users`
- `one` — decidedByUser: `users` (decidedBy)

---

### complaints
**Description:** Client complaints about services or delivery.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `name` | text | Required | Complainant name |
| `email` | text | Required | Complainant email |
| `productManagerName` | text | Optional | Associated PM name |
| `developerName` | text | Optional | Associated developer name |
| `technicalManagerName` | text | Optional | Associated tech manager name |
| `valuableThings` | json | Default: [] | Array of positive aspects |
| `detailedExplanation` | text | Required | Complaint details |
| `screenshotUrl` | text | Optional | Evidence screenshot |
| `status` | text | Default: `pending` | Complaint status |
| `reviewComments` | text | Optional | Admin comments |
| `submitterId` | integer | Optional FK to users | Internal submitter |
| `reviewedBy` | integer | Optional FK to users | Admin reviewer |
| `createdAt` | timestamp | Default: now | Creation date |
| `reviewedAt` | timestamp | Optional | Review date |

**Relationships:**
- `one` — submitter: `users`
- `one` — reviewer: `users`

---

### staffComplaints
**Description:** Internal complaints from staff members.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `name` | text | Required | Complainant name |
| `email` | text | Required | Complainant email |
| `department` | text | Optional | Department name |
| `detailedExplanation` | text | Required | Complaint details |
| `screenshotUrl` | text | Optional | Evidence screenshot |
| `status` | text | Default: `pending` | Complaint status |
| `reviewComments` | text | Optional | Admin comments |
| `submitterId` | integer | Optional FK to users | Submitter |
| `reviewedAt` | timestamp | Optional | Review date |
| `createdAt` | timestamp | Default: now | Creation date |

**Relationships:**
- `one` — submitter: `users`

---

### staffQueries
**Description:** Formal queries or disciplinary documents regarding staff performance.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `staffId` | integer | Required FK to users (cascade delete) | Staff member queried |
| `staffName` | text | Required | Staff member name |
| `department` | text | Required | Department name |
| `staffUniqueValue` | text | Required | Unique identifier |
| `reason` | enum | Required | `wrongly_using_work_app`, `substandard_delivery`, `repeatedly_missed_deadlines`, `disrespectful_communication`, `disregard_company_policy` |
| `whyQuery` | text | Required | Detailed reason |
| `attachmentPath` | text | Optional | Document attachment |
| `likelyPenalty` | text | Required | Expected consequence |
| `additionalNote` | text | Optional | Additional notes |
| `sentBy` | integer | Required FK to users | Query sender |
| `status` | enum | Default: `pending` | `pending`, `acknowledged`, `resolved` |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Relationships:**
- `one` — staff: `users`
- `one` — sender: `users` (sentBy)

---

### clientSentiment
**Description:** Weekly sentiment/satisfaction submissions from clients about services.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `clientId` | integer | Required FK to users (cascade delete) | Client user |
| `sentiment` | enum | Required | `satisfied`, `dissatisfied`, `flags` |
| `reason` | text | Required | Reason for sentiment |
| `weekStart` | text | Required | Week start date |
| `weekEnd` | text | Required | Week end date |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Relationships:**
- `one` — client: `users`

---

### sops
**Description:** Standard Operating Procedures documents organized by department.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `title` | text | Required | SOP title |
| `department` | text | Required | Department name |
| `referenceLink` | text | Optional | External reference link |
| `createdBy` | integer | Required FK to users | SOP creator |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Relationships:**
- `one` — creator: `users`
- `many` — segments: `sopSegments`

---

### sopSegments
**Description:** Individual sections within SOP documents.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `sopId` | integer | Required FK to sops (cascade delete) | Parent SOP |
| `title` | text | Required | Segment title |
| `content` | text | Required | Segment content |
| `fileUrl` | text | Optional | Attached file URL |
| `segmentOrder` | integer | Default: 0, Required | Display order |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Relationships:**
- `one` — sop: `sops`

---

### issueReports
**Description:** Bug and feature request reports from users.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `submitterId` | integer | Required FK to users (cascade delete) | Report submitter |
| `reporterName` | text | Required | Reporter name |
| `reporterEmail` | text | Required | Reporter email |
| `title` | text | Required | Issue title |
| `description` | text | Required | Issue description |
| `suggestions` | text | Optional | Improvement suggestions |
| `priority` | enum | Default: `medium` | `low`, `medium`, `high`, `urgent` |
| `category` | enum | Default: `other` | `bug`, `feature_request`, `improvement`, `other` |
| `status` | enum | Default: `pending` | `pending`, `reviewing`, `resolved`, `closed` |
| `screenshotUrl` | text | Optional | Evidence screenshot |
| `reviewedBy` | integer | Optional FK to users | Admin reviewer |
| `reviewedAt` | timestamp | Optional | Review date |
| `reviewComments` | text | Optional | Review comments |
| `createdAt` | timestamp | Default: now, Required | Creation date |
| `updatedAt` | timestamp | Default: now, Required | Last update date |

**Relationships:**
- `one` — submitter: `users`
- `one` — reviewer: `users`

---

### reviewLinks
**Description:** Links submitted by project managers for team lead review and approval.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `title` | text | Required | Link title |
| `linkUrl` | text | Required | The URL to review |
| `description` | text | Optional | Link description |
| `sentBy` | integer | Required FK to users (cascade delete) | Submitting PM |
| `assignedTo` | integer | Required FK to users (cascade delete) | Reviewing team lead |
| `status` | enum | Default: `pending` | `pending`, `reviewed`, `needs_revision`, `not_approved` |
| `reviewedAt` | timestamp | Optional | When review completed |
| `reviewComment` | text | Optional | Review feedback |
| `commentedAt` | timestamp | Optional | When comment added |
| `createdAt` | timestamp | Default: now, Required | Creation date |
| `updatedAt` | timestamp | Default: now, Required | Last update date |

**Relationships:**
- `one` — sender: `users` (sentBy)
- `one` — assignee: `users` (assignedTo)

---

### projectBriefings
**Description:** Project briefing documents created for project context.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `projectName` | text | Required | Project name |
| `clientName` | text | Required | Client name |
| `category` | text | Required | Project category |
| `projectDetails` | text | Required | Detailed project information |
| `createdBy` | integer | Required FK to users (cascade delete) | Briefing creator |
| `createdAt` | timestamp | Default: now, Required | Creation date |
| `updatedAt` | timestamp | Default: now, Required | Last update date |

**Relationships:**
- `one` — creator: `users`

---

### stopGapAllocations
**Description:** Temporary monthly hour allocations for staff on stop-gap projects.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `userId` | integer | Required FK to users (cascade delete) | Allocated staff member |
| `monthYear` | text | Required | Month in "YYYY-MM" format |
| `totalHours` | integer | Default: 5, Required | Total hours allocated |
| `usedHours` | integer | Default: 0, Required | Hours already used |
| `remainingHours` | integer | Default: 300, Required | Hours remaining (stored as minutes, 5 hrs = 300 min) |
| `createdAt` | timestamp | Default: now | Creation date |
| `updatedAt` | timestamp | Default: now | Last update date |

**Relationships:**
- `one` — user: `users`

---

### stopGapTaskAssignments
**Description:** Individual task assignments under stop-gap allocations.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `taskId` | integer | Required FK to tasks (cascade delete) | Assigned task |
| `userId` | integer | Required FK to users (cascade delete) | Assigned staff |
| `stopGapHours` | integer | Required | Hours applied (stored as minutes) |
| `monthYear` | text | Required | Month in "YYYY-MM" format |
| `appliedAt` | timestamp | Default: now | When assignment was applied |

**Relationships:**
- `one` — task: `tasks`
- `one` — user: `users`

---

### clientInvitations
**Description:** One-time invitation tokens for clients to join the system.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `email` | text | Required | Invited email address |
| `projectId` | integer | Optional FK to projects | Associated project |
| `invitedBy` | integer | Optional FK to users | User who sent invitation |
| `token` | text | Required | Unique invitation token |
| `status` | enum | Default: `pending` | `pending`, `accepted`, `declined` |
| `expiresAt` | timestamp | Required | Token expiration date |
| `createdAt` | timestamp | Default: now | Creation date |

**Relationships:**
- `one` — project: `projects`
- `one` — invitedByUser: `users`

---

### messages (Legacy)
**Description:** Legacy project messages table (mostly superseded by projectMessages).

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `content` | text | Required | Message content |
| `projectId` | integer | Optional FK to projects | Project reference |
| `userId` | integer | Optional FK to users | Message sender |
| `createdAt` | timestamp | Default: now | Creation date |

**Relationships:**
- `one` — project: `projects`
- `one` — user: `users`

---

### performance (Legacy)
**Description:** Staff performance metrics storage.

| Field | Type | Validation | Notes |
|---|---|---|---|
| `id` | integer | Primary Key | Auto-generated |
| `userId` | integer | Optional FK to users | User reference |
| `metrics` | jsonb | Required | Performance metrics JSON |
| `date` | timestamp | Default: now | Record date |

---

# Prompt D: Complete API Endpoint Reference

## Authentication Endpoints (from auth.ts)

### POST /api/login
- **Purpose:** Authenticate user with username and password
- **Request:** `{ username: string, password: string }`
- **Response:** `{ message: string, user: { id, username, role, name } }`
- **Auth Required:** No
- **Notes:** Sets session cookie, triggers user status update to ONLINE

### GET /api/user
- **Purpose:** Get current authenticated user profile
- **Request:** None
- **Response:** Full `User` object
- **Auth Required:** Yes (Session-based)

### POST /api/logout
- **Purpose:** Logout user and destroy session
- **Request:** None
- **Response:** `{ message: string, logoutOneSignal: boolean }`
- **Auth Required:** Yes
- **Notes:** Updates user status to OFFLINE, clears session cookie

### POST /api/register
- **Purpose:** Create new user account (admin only)
- **Request:** `{ username, password, name, email, role, breakOneTime?, specialization?, projectManagerType?, ... }`
- **Response:** `{ message, user: { id, username, role, name }, setupToken }`
- **Auth Required:** Yes (operations_manager or team_lead only)
- **Notes:** Sends account setup email with setupToken

### POST /api/setup-password
- **Purpose:** Set initial password for new account (via email token)
- **Request:** `{ username, token, newPassword }`
- **Response:** `{ message: string }`
- **Auth Required:** No
- **Notes:** Token must be valid and user.mustSetPassword must be true

### POST /api/forgot-password
- **Purpose:** Initiate password reset for account recovery
- **Request:** `{ email, username }`
- **Response:** `{ message: string }`
- **Auth Required:** No
- **Notes:** Sends password reset email if account found

### POST /api/reset-password
- **Purpose:** Complete password reset with token
- **Request:** `{ username, token, newPassword }`
- **Response:** `{ message: string }`
- **Auth Required:** No

### GET /api/verify-email/:token
- **Purpose:** Verify email address with token
- **Request:** None (token in URL)
- **Response:** `{ message: string }`
- **Auth Required:** No

---

## Health & Status

### GET /api/health/session
- **Purpose:** Check session health and configuration
- **Request:** None
- **Response:** `{ authenticated: boolean, user?, sessionConfig: {...} }`
- **Auth Required:** No

### GET /api/health/database
- **Purpose:** Test database connection
- **Request:** None
- **Response:** `{ status: string, message: string }`
- **Auth Required:** No

---

## User & Account Management

### GET /api/public/users
- **Purpose:** Get list of all active users (public directory)
- **Request:** None
- **Response:** `User[]` array
- **Auth Required:** No

### GET /api/users
- **Purpose:** Get all users with roles
- **Request:** None
- **Response:** `User[]` array
- **Auth Required:** Yes

### GET /api/users/all
- **Purpose:** Get all users (alternative endpoint)
- **Request:** None
- **Response:** `User[]` array
- **Auth Required:** Yes

### GET /api/users/staff
- **Purpose:** Get only staff and support officer users
- **Request:** None
- **Response:** `User[]` array
- **Auth Required:** Yes

### GET /api/staff
- **Purpose:** Get staff and customer support officers
- **Request:** None
- **Response:** `User[]` array
- **Auth Required:** Yes

### PUT /api/users/status
- **Purpose:** Update user status (online/offline/idle)
- **Request:** `{ status: 'online' | 'offline' | 'idle' }`
- **Response:** Updated `User` object
- **Auth Required:** Yes

### POST /api/user/heartbeat
- **Purpose:** Send heartbeat to keep user active
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes
- **Notes:** Updates lastActive timestamp

### GET /api/user-control/users
- **Purpose:** Get users for admin control panel
- **Request:** None
- **Response:** `User[]` with status
- **Auth Required:** Yes (Admin)

### PATCH /api/user-control/:userId
- **Purpose:** Update user control status
- **Request:** `{ status: string }`
- **Response:** Updated user
- **Auth Required:** Yes (Admin)

### POST /api/user-control/:userId/status
- **Purpose:** Change user online/offline status
- **Request:** `{ status: string }`
- **Response:** Updated user
- **Auth Required:** Yes (Admin)

---

## Projects

### GET /api/projects
- **Purpose:** Get all projects user is member of
- **Request:** None
- **Response:** `Project[]` array with members, tasks, messages
- **Auth Required:** Yes

### POST /api/projects
- **Purpose:** Create new project
- **Request:** `{ name, type, description?, status?, startDate?, endDate?, clientId? }`
- **Response:** Created `Project` object
- **Auth Required:** Yes (Project Manager)

### GET /api/projects/:id
- **Purpose:** Get detailed project information
- **Request:** None
- **Response:** `Project` with full details, members, plans, resources
- **Auth Required:** Yes

### PUT /api/projects/:id
- **Purpose:** Update project information
- **Request:** `{ name?, description?, status?, progress?, ... }`
- **Response:** Updated `Project` object
- **Auth Required:** Yes (Project Manager)

### DELETE /api/projects/:id
- **Purpose:** Delete project
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes (Admin)

### POST /api/projects/:id/complete
- **Purpose:** Mark project as completed
- **Request:** None
- **Response:** Updated `Project`
- **Auth Required:** Yes (Project Manager)

### GET /api/projects/:id/members
- **Purpose:** Get project team members
- **Request:** None
- **Response:** `ProjectMember[]` with user details
- **Auth Required:** Yes

### GET /api/projects/:id/tasks
- **Purpose:** Get all tasks in project
- **Request:** None
- **Response:** `Task[]` array
- **Auth Required:** Yes

### GET /api/projects/:id/plans
- **Purpose:** Get project plans and deliverables
- **Request:** None
- **Response:** `ProjectPlan[]` with deliverables
- **Auth Required:** Yes

### GET /api/projects/:id/resources
- **Purpose:** Get project resources (files/links)
- **Request:** None
- **Response:** `Resource[]` array
- **Auth Required:** Yes

### POST /api/projects/:id/resources/upload
- **Purpose:** Upload file resource to project
- **Request:** FormData with file
- **Response:** Created `Resource` object
- **Auth Required:** Yes
- **Notes:** Uses multer, single file upload

### POST /api/projects/:id/resources/link
- **Purpose:** Add external link resource to project
- **Request:** `{ name, link }`
- **Response:** Created `Resource` object
- **Auth Required:** Yes

### PUT /api/projects/:projectId/resources/:id
- **Purpose:** Update resource details
- **Request:** `{ name?, link?, ... }`
- **Response:** Updated `Resource`
- **Auth Required:** Yes

### DELETE /api/projects/:projectId/resources/:id
- **Purpose:** Delete resource
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

### POST /api/projects/:id/plans
- **Purpose:** Create project plan
- **Request:** `{ name, description?, startDate?, endDate?, ... }`
- **Response:** Created `ProjectPlan` object
- **Auth Required:** Yes

### GET /api/project-plans/:id
- **Purpose:** Get specific project plan with deliverables
- **Request:** None
- **Response:** `ProjectPlan` with `Deliverable[]`
- **Auth Required:** Yes

### PUT /api/project-plans/:id
- **Purpose:** Update project plan
- **Request:** `{ name?, description?, status?, ... }`
- **Response:** Updated `ProjectPlan`
- **Auth Required:** Yes

### DELETE /api/project-plans/:id
- **Purpose:** Delete project plan
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

### PATCH /api/deliverables/:id/status
- **Purpose:** Update deliverable status
- **Request:** `{ status: 'pending' | 'in_progress' | 'completed' | 'overdue' }`
- **Response:** Updated `Deliverable`
- **Auth Required:** Yes

### GET /api/projects/recent-activity
- **Purpose:** Get recent activity across projects
- **Request:** None
- **Response:** Activity objects with timestamps
- **Auth Required:** Yes

### GET /api/projects/unread-counts
- **Purpose:** Get unread message counts per project
- **Request:** None
- **Response:** `{ [projectId]: count }`
- **Auth Required:** Yes

---

## Tasks & Time Tracking

### GET /api/tasks
- **Purpose:** Get all tasks assigned to user
- **Request:** None
- **Response:** `Task[]` array with project, assignee, time data
- **Auth Required:** Yes

### POST /api/tasks
- **Purpose:** Create new task
- **Request:** `{ title, description?, projectId, assigneeId?, priority?, deadline?, ... }`
- **Response:** Created `Task` object
- **Auth Required:** Yes

### GET /api/tasks/:id
- **Purpose:** Get task details
- **Request:** None
- **Response:** `Task` with iterations, sessions, project info
- **Auth Required:** Yes

### PUT /api/tasks/:id
- **Purpose:** Update task information
- **Request:** `{ title?, description?, status?, priority?, progress?, ... }`
- **Response:** Updated `Task`
- **Auth Required:** Yes

### PUT /api/tasks/:id/status
- **Purpose:** Update only task status
- **Request:** `{ status: string }`
- **Response:** Updated `Task`
- **Auth Required:** Yes

### DELETE /api/tasks/:id
- **Purpose:** Delete task
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

### POST /api/tasks/:id/start-timer
- **Purpose:** Start timer for task work
- **Request:** None
- **Response:** `{ message, taskSession }`
- **Auth Required:** Yes
- **Notes:** Creates TaskSession, sets isTimerRunning=true

### POST /api/tasks/:id/stop-timer
- **Purpose:** Stop timer and save session
- **Request:** None
- **Response:** `{ message, totalTimeSpent, session }`
- **Auth Required:** Yes
- **Notes:** Calculates duration, updates timeSpent

### POST /api/tasks/:id/pause-timer
- **Purpose:** Pause timer without ending session
- **Request:** None
- **Response:** `{ message, timeSpent }`
- **Auth Required:** Yes

### POST /api/tasks/:id/submit
- **Purpose:** Submit completed task for review
- **Request:** None
- **Response:** Updated `Task`, creates notification
- **Auth Required:** Yes
- **Notes:** Moves task to "review" status, notifies project manager

### POST /api/tasks/:id/reassign
- **Purpose:** Reassign task to different user
- **Request:** `{ assigneeId }`
- **Response:** Updated `Task` with new assignee
- **Auth Required:** Yes (Project Manager)

### GET /api/tasks/:id/iterations
- **Purpose:** Get task iteration history
- **Request:** None
- **Response:** `TaskIteration[]` array
- **Auth Required:** Yes

---

## Messages & Communication

### Direct Messages

#### GET /api/direct-messages/conversations
- **Purpose:** Get list of all conversations
- **Request:** None
- **Response:** Array of conversations with last message and unread count
- **Auth Required:** Yes

#### GET /api/direct-messages/:userId
- **Purpose:** Get message history with specific user
- **Request:** None
- **Response:** `DirectMessage[]` array, ordered by createdAt
- **Auth Required:** Yes

#### POST /api/direct-messages
- **Purpose:** Send direct message
- **Request:** `{ receiverId, content }`
- **Response:** Created `DirectMessage` object
- **Auth Required:** Yes
- **Notes:** Triggers SSE notification to receiver

#### PUT /api/direct-messages/:userId/read
- **Purpose:** Mark all messages with user as read
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

#### PUT /api/direct-messages/:messageId
- **Purpose:** Update message content
- **Request:** `{ content }`
- **Response:** Updated `DirectMessage`
- **Auth Required:** Yes (message sender)

#### DELETE /api/direct-messages/:messageId
- **Purpose:** Delete message
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

#### GET /api/direct-messages/unread-count
- **Purpose:** Get total unread message count
- **Request:** None
- **Response:** `{ count: number }`
- **Auth Required:** Yes

#### GET /api/direct-messages/:messageId/read-count
- **Purpose:** Get how many users read message
- **Request:** None
- **Response:** `{ count, userNames }`
- **Auth Required:** Yes

#### GET /api/direct-messages/has-updates
- **Purpose:** Check if user has unread messages
- **Request:** None
- **Response:** `{ hasUpdates: boolean }`
- **Auth Required:** Yes

### Project Team Messages

#### GET /api/projects/:projectId/team-messages
- **Purpose:** Get team chat messages for project
- **Request:** None
- **Response:** `ProjectMessage[]` array with sender, read receipts
- **Auth Required:** Yes

#### POST /api/projects/:projectId/team-messages
- **Purpose:** Send message to project team chat
- **Request:** `{ content }`
- **Response:** Created `ProjectMessage`
- **Auth Required:** Yes
- **Notes:** Triggers SSE notification to project members

#### PUT /api/projects/:projectId/team-messages/:messageId
- **Purpose:** Update team message
- **Request:** `{ content }`
- **Response:** Updated `ProjectMessage`
- **Auth Required:** Yes (message sender)

#### DELETE /api/projects/:projectId/team-messages/:messageId
- **Purpose:** Delete team message
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

#### POST /api/projects/:projectId/team-messages/mark-read
- **Purpose:** Mark all team messages as read
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

#### GET /api/projects/:projectId/team-messages/:messageId/read-count
- **Purpose:** Get read receipt count for message
- **Request:** None
- **Response:** `{ count, users }`
- **Auth Required:** Yes

### General Channel

#### GET /api/general-channel/messages
- **Purpose:** Get all general channel messages
- **Request:** None
- **Response:** `GeneralChannelMessage[]` with sender, reactions, read receipts
- **Auth Required:** Yes

#### POST /api/general-channel/messages
- **Purpose:** Send message to general channel
- **Request:** `{ content }`
- **Response:** Created `GeneralChannelMessage`
- **Auth Required:** Yes
- **Notes:** Broadcasts to all users via SSE

#### PUT /api/general-channel/messages/:id
- **Purpose:** Edit general channel message
- **Request:** `{ content }`
- **Response:** Updated message with isEdited=true
- **Auth Required:** Yes (message sender)

#### DELETE /api/general-channel/messages/:id
- **Purpose:** Delete general channel message
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

#### POST /api/general-channel/messages/:messageId/react
- **Purpose:** Add emoji reaction to message
- **Request:** `{ emoji }`
- **Response:** Updated message with reactions
- **Auth Required:** Yes

#### POST /api/general-channel/messages/:messageId/pin
- **Purpose:** Pin message in general channel
- **Request:** None
- **Response:** Updated message with isPinned=true
- **Auth Required:** Yes (Admin)

#### DELETE /api/general-channel/messages/:messageId/pin
- **Purpose:** Unpin message
- **Request:** None
- **Response:** Updated message
- **Auth Required:** Yes (Admin)

#### GET /api/general-channel/unread-count
- **Purpose:** Get unread message count for general channel
- **Request:** None
- **Response:** `{ count: number }`
- **Auth Required:** Yes

#### GET /api/general-channel/messages/:messageId/read-count
- **Purpose:** Get read receipt count
- **Request:** None
- **Response:** `{ count, users }`
- **Auth Required:** Yes

#### POST /api/general-channel/mark-read
- **Purpose:** Mark all general channel messages as read
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

---

## Memos

### GET /api/memos
- **Purpose:** Get all memos (managers see all, others see targeted)
- **Request:** None
- **Response:** `Memo[]` with sender name, read status, response count
- **Auth Required:** Yes

### GET /api/memos/my-memos
- **Purpose:** Get memos sent to current user
- **Request:** None
- **Response:** `Memo[]` array targeted to user
- **Auth Required:** Yes

### POST /api/memos
- **Purpose:** Create and send memo
- **Request:** `{ title, content, type, recipients }`
- **Response:** Created `Memo` object
- **Auth Required:** Yes (Operations Manager or Team Lead)
- **Notes:** recipients is array of user IDs or department names

### POST /api/memos/:id/mark-read
- **Purpose:** Mark memo as read by user
- **Request:** None
- **Response:** Created `MemoRead` entry
- **Auth Required:** Yes

### DELETE /api/memos/:id
- **Purpose:** Delete memo
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes (memo sender)

### GET /api/memos/:id/responses
- **Purpose:** Get all responses to memo
- **Request:** None
- **Response:** `MemoResponse[]` array with user info
- **Auth Required:** Yes

### POST /api/memos/:id/responses
- **Purpose:** Submit response to memo
- **Request:** `{ content }`
- **Response:** Created `MemoResponse`
- **Auth Required:** Yes
- **Notes:** Enforces one response per user per memo, notifies sender

---

## Notifications

### GET /api/notifications
- **Purpose:** Get user's notifications
- **Request:** None
- **Response:** `Notification[]` array
- **Auth Required:** Yes

### GET /api/notifications/stream
- **Purpose:** SSE stream for real-time notifications
- **Request:** None (persistent connection)
- **Response:** Server-Sent Events with notification data
- **Auth Required:** Yes
- **Notes:** Broadcasts notifications, messages, mentions as they occur

### PUT /api/notifications/:id/read
- **Purpose:** Mark notification as read
- **Request:** None
- **Response:** Updated `Notification`
- **Auth Required:** Yes

### PUT /api/notifications/read-all
- **Purpose:** Mark all notifications as read
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

### DELETE /api/notifications/:id
- **Purpose:** Delete notification
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

### POST /api/notifications/test
- **Purpose:** Test notification system (debug)
- **Request:** None
- **Response:** Test notification sent
- **Auth Required:** Yes (Admin)

### GET /api/mentions/unread-count
- **Purpose:** Get count of unread mentions
- **Request:** None
- **Response:** `{ count: number }`
- **Auth Required:** Yes

---

## Leave & Time Off

### GET /api/leave-applications
- **Purpose:** Get user's own leave applications
- **Request:** None
- **Response:** `LeaveApplication[]` array
- **Auth Required:** Yes

### GET /api/leave-applications/all
- **Purpose:** Get all leave applications (manager view)
- **Request:** None
- **Response:** `LeaveApplication[]` array for all staff
- **Auth Required:** Yes (Admin/Manager)

### POST /api/leave-applications
- **Purpose:** Submit leave request
- **Request:** FormData with: `leaveType, reason, startDate, endDate, totalDays, proofImage?`
- **Response:** Created `LeaveApplication`
- **Auth Required:** Yes
- **Notes:** Uses multer for proof image upload

### PUT /api/leave-applications/:id/review
- **Purpose:** Review and approve/reject leave request
- **Request:** `{ status, reviewComments? }`
- **Response:** Updated `LeaveApplication`
- **Auth Required:** Yes (Manager)

### GET /api/leave-applications/has-pending
- **Purpose:** Check if there are pending leave requests
- **Request:** None
- **Response:** `{ hasPending: boolean }`
- **Auth Required:** Yes

### GET /api/leave-applications/has-updates
- **Purpose:** Check if user has leave updates
- **Request:** None
- **Response:** `{ hasUpdates: boolean }`
- **Auth Required:** Yes

### POST /api/leave-applications/mark-viewed
- **Purpose:** Mark leave updates as viewed
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

---

## Bookings & Meetings

### GET /api/bookings
- **Purpose:** Get all bookings
- **Request:** None
- **Response:** `Booking[]` array
- **Auth Required:** Yes

### GET /api/bookings/my-upcoming
- **Purpose:** Get user's upcoming bookings
- **Request:** None
- **Response:** `Booking[]` array, future dates only
- **Auth Required:** Yes

### POST /api/bookings
- **Purpose:** Create new booking
- **Request:** `{ title, type, participants[], startTime, endTime, description?, meetingLink?, notes? }`
- **Response:** Created `Booking` object
- **Auth Required:** Yes

### PUT /api/bookings/:id
- **Purpose:** Update booking
- **Request:** `{ title?, type?, participants?, startTime?, endTime?, status?, ... }`
- **Response:** Updated `Booking`
- **Auth Required:** Yes (booking scheduler)

### DELETE /api/bookings/:id
- **Purpose:** Delete booking
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

---

## Technical Support

### GET /api/technical-support/requests
- **Purpose:** Get technical support requests (admin view)
- **Request:** None
- **Response:** `TechnicalSupportRequest[]` array
- **Auth Required:** Yes (Admin)

### POST /api/technical-support/requests
- **Purpose:** Submit technical support request
- **Request:** `{ title, description, taskId?, priority? }`
- **Response:** Created `TechnicalSupportRequest`
- **Auth Required:** Yes

### POST /api/technical-support/requests/:id/assign
- **Purpose:** Assign support request to staff member
- **Request:** `{ assignedToId }`
- **Response:** Updated request with assignment
- **Auth Required:** Yes (Admin)

### PUT /api/technical-support/requests/:id
- **Purpose:** Update support request (add resolution)
- **Request:** `{ status?, resolution?, priority? }`
- **Response:** Updated `TechnicalSupportRequest`
- **Auth Required:** Yes

### GET /api/technical-support/has-unassigned
- **Purpose:** Check for unassigned support requests
- **Request:** None
- **Response:** `{ hasUnassigned: boolean }`
- **Auth Required:** Yes

### GET /api/technical-support/has-updates
- **Purpose:** Check if there are support request updates
- **Request:** None
- **Response:** `{ hasUpdates: boolean }`
- **Auth Required:** Yes

### POST /api/technical-support/mark-viewed
- **Purpose:** Mark support request updates as viewed
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

---

## Deadline Extensions

### GET /api/deadline-extension-requests
- **Purpose:** Get deadline extension requests
- **Request:** None
- **Response:** `DeadlineExtensionRequest[]` array
- **Auth Required:** Yes

### POST /api/deadline-extension-requests
- **Purpose:** Request deadline extension
- **Request:** `{ taskId, reason, requestedDeadline? }`
- **Response:** Created request
- **Auth Required:** Yes

### PUT /api/deadline-extension-requests/:id
- **Purpose:** Review and approve/decline extension
- **Request:** `{ status, decisionReason?, approvedDeadline?, approvedWorkingHours? }`
- **Response:** Updated request
- **Auth Required:** Yes (Project Manager)

### GET /api/deadline-extension-requests/has-updates
- **Purpose:** Check for deadline extension updates
- **Request:** None
- **Response:** `{ hasUpdates: boolean }`
- **Auth Required:** Yes

---

## Complaints & Feedback

### Complaints (Client)

#### GET /api/complaints
- **Purpose:** Get all complaints (admin view)
- **Request:** None
- **Response:** `Complaint[]` array
- **Auth Required:** Yes (Admin)

#### GET /api/complaints/my-complaints
- **Purpose:** Get user's submitted complaints
- **Request:** None
- **Response:** `Complaint[]` for current user
- **Auth Required:** Yes

#### POST /api/complaints
- **Purpose:** Submit complaint
- **Request:** FormData with: `name, email, detailedExplanation, screenshot?, productManagerName?, developerName?, technicalManagerName?, valuableThings[]?`
- **Response:** Created `Complaint`
- **Auth Required:** Yes

#### PUT /api/complaints/:id
- **Purpose:** Update complaint status (admin review)
- **Request:** `{ status, reviewComments? }`
- **Response:** Updated complaint
- **Auth Required:** Yes (Admin)

#### GET /api/complaints/has-new
- **Purpose:** Check for new complaints
- **Request:** None
- **Response:** `{ hasNew: boolean }`
- **Auth Required:** Yes (Admin)

#### GET /api/complaints/my-complaints/has-updates
- **Purpose:** Check if user has complaint updates
- **Request:** None
- **Response:** `{ hasUpdates: boolean }`
- **Auth Required:** Yes

### Staff Complaints

#### GET /api/staff-complaints
- **Purpose:** Get all staff complaints
- **Request:** None
- **Response:** `StaffComplaint[]` array
- **Auth Required:** Yes (Admin)

#### GET /api/staff-complaints/my-complaints
- **Purpose:** Get user's staff complaints
- **Request:** None
- **Response:** `StaffComplaint[]` for current user
- **Auth Required:** Yes

#### POST /api/staff-complaints
- **Purpose:** Submit internal staff complaint
- **Request:** `{ name, email, department?, detailedExplanation, screenshot? }`
- **Response:** Created complaint
- **Auth Required:** Yes

#### PUT /api/staff-complaints/:id
- **Purpose:** Update staff complaint status
- **Request:** `{ status, reviewComments? }`
- **Response:** Updated complaint
- **Auth Required:** Yes (Admin)

#### GET /api/staff-complaints/has-new
- **Purpose:** Check for new staff complaints
- **Request:** None
- **Response:** `{ hasNew: boolean }`
- **Auth Required:** Yes

#### POST /api/staff-complaints/mark-viewed
- **Purpose:** Mark complaints as viewed
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

#### GET /api/staff-complaints/my-complaints/has-updates
- **Purpose:** Check if complaints have updates
- **Request:** None
- **Response:** `{ hasUpdates: boolean }`
- **Auth Required:** Yes

---

## Issue Reports & Feedback

### GET /api/issue-reports
- **Purpose:** Get all issue reports
- **Request:** None
- **Response:** `IssueReport[]` array
- **Auth Required:** Yes (Admin)

### POST /api/issue-reports
- **Purpose:** Submit bug or feature request
- **Request:** FormData with: `reporterName, reporterEmail, title, description, suggestions?, priority, category, screenshot?`
- **Response:** Created `IssueReport`
- **Auth Required:** Yes
- **Notes:** Uses multer for screenshot

### PUT /api/issue-reports/:id
- **Purpose:** Update issue status (admin)
- **Request:** `{ status, reviewComments? }`
- **Response:** Updated report
- **Auth Required:** Yes (Admin)

### GET /api/issue-reports/has-unresolved
- **Purpose:** Check for unresolved issues
- **Request:** None
- **Response:** `{ hasUnresolved: boolean }`
- **Auth Required:** Yes (Admin)

### GET /api/issue-reports/has-updates
- **Purpose:** Check for issue report updates
- **Request:** None
- **Response:** `{ hasUpdates: boolean }`
- **Auth Required:** Yes

---

## Client Management

### GET /api/clients
- **Purpose:** Get list of clients
- **Request:** None
- **Response:** `User[]` (filtered by role = 'client')
- **Auth Required:** Yes

### GET /api/clients/management
- **Purpose:** Get clients for management view
- **Request:** None
- **Response:** Client users with onboarding status
- **Auth Required:** Yes (Admin)

### GET /api/clients/has-new
- **Purpose:** Check if there are new clients
- **Request:** None
- **Response:** `{ hasNew: boolean }`
- **Auth Required:** Yes (Admin)

### GET /api/client-accounts
- **Purpose:** Get detailed client account information
- **Request:** None
- **Response:** Array of client objects with account details
- **Auth Required:** Yes

### POST /api/client-accounts
- **Purpose:** Create new client account
- **Request:** Client account data
- **Response:** Created client
- **Auth Required:** Yes (Admin)

### PUT /api/clients/:id/onboarding-status
- **Purpose:** Update client onboarding status
- **Request:** `{ onboardingStatus }`
- **Response:** Updated client
- **Auth Required:** Yes (Admin)

### POST /api/clients/mark-viewed
- **Purpose:** Mark client updates as viewed
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

---

## Client Sentiment & Feedback

### GET /api/client-sentiment/current-week
- **Purpose:** Get current week's sentiment submission
- **Request:** None
- **Response:** `ClientSentiment` object for this week or null
- **Auth Required:** Yes (Client)

### GET /api/client-sentiment/all
- **Purpose:** Get all client sentiment data
- **Request:** None
- **Response:** `ClientSentiment[]` array
- **Auth Required:** Yes (Admin)

### POST /api/client-sentiment
- **Purpose:** Submit weekly sentiment feedback
- **Request:** `{ sentiment, reason, weekStart, weekEnd }`
- **Response:** Created `ClientSentiment`
- **Auth Required:** Yes (Client)

### GET /api/client-sentiment/has-new
- **Purpose:** Check for new sentiment submissions
- **Request:** None
- **Response:** `{ hasNew: boolean }`
- **Auth Required:** Yes (Admin)

### GET /api/client-sentiment/needs-weekly-submission
- **Purpose:** Check if client needs to submit weekly sentiment
- **Request:** None
- **Response:** `{ needsSubmission: boolean }`
- **Auth Required:** Yes (Client)

---

## Standard Operating Procedures (SOPs)

### GET /api/sops
- **Purpose:** Get all SOPs
- **Request:** None
- **Response:** `Sop[]` with segments
- **Auth Required:** Yes

### GET /api/sops/departments
- **Purpose:** Get departments with SOPs
- **Request:** None
- **Response:** Array of department names
- **Auth Required:** Yes

### POST /api/sops
- **Purpose:** Create new SOP
- **Request:** `{ title, department, segments[], referenceLink? }`
- **Response:** Created `Sop`
- **Auth Required:** Yes (Admin)

### PUT /api/sops/:id
- **Purpose:** Update SOP
- **Request:** `{ title?, department?, ... }`
- **Response:** Updated `Sop`
- **Auth Required:** Yes (Admin)

### DELETE /api/sops/:id
- **Purpose:** Delete SOP
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes (Admin)

### POST /api/sops/upload-file
- **Purpose:** Upload file to attach to SOP segment
- **Request:** FormData with file
- **Response:** `{ fileUrl, message }`
- **Auth Required:** Yes
- **Notes:** Uses multer, returns file path/URL

---

## Review Links

### GET /api/review-links
- **Purpose:** Get review links (PM submitted or TL assigned)
- **Request:** None
- **Response:** `ReviewLink[]` array
- **Auth Required:** Yes

### POST /api/review-links
- **Purpose:** Submit link for review
- **Request:** `{ title, linkUrl, description? }`
- **Response:** Created `ReviewLink`
- **Auth Required:** Yes (Project Manager)
- **Notes:** Auto-assigns to team lead, triggers notification

### PUT /api/review-links/:id/reviewed
- **Purpose:** Mark link as reviewed/approved
- **Request:** `{ reviewComment? }`
- **Response:** Updated `ReviewLink` with status='reviewed'
- **Auth Required:** Yes (Team Lead)

### PUT /api/review-links/:id/not-approved
- **Purpose:** Reject link for revision
- **Request:** `{ reviewComment? }`
- **Response:** Updated `ReviewLink` with status='not_approved'
- **Auth Required:** Yes (Team Lead)

### PUT /api/review-links/:id/comment
- **Purpose:** Add comment requesting revision
- **Request:** `{ reviewComment }`
- **Response:** Updated `ReviewLink` with status='needs_revision'
- **Auth Required:** Yes (Team Lead)

### DELETE /api/review-links/:id
- **Purpose:** Delete review link
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

### GET /api/review-links/has-unreviewed
- **Purpose:** Check if there are unreviewed links
- **Request:** None
- **Response:** `{ hasUnreviewed: boolean }`
- **Auth Required:** Yes

---

## Project Briefings

### GET /api/project-briefings
- **Purpose:** Get all project briefings
- **Request:** None
- **Response:** `ProjectBriefing[]` array
- **Auth Required:** Yes

### POST /api/project-briefings
- **Purpose:** Create project briefing
- **Request:** `{ projectName, clientName, category, projectDetails }`
- **Response:** Created `ProjectBriefing`
- **Auth Required:** Yes

### PUT /api/project-briefings/:id
- **Purpose:** Update briefing
- **Request:** `{ projectName?, clientName?, category?, projectDetails? }`
- **Response:** Updated `ProjectBriefing`
- **Auth Required:** Yes

### DELETE /api/project-briefings/:id
- **Purpose:** Delete briefing
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

---

## Staff Queries & Discipline

### GET /api/staff-queries
- **Purpose:** Get staff queries (formal warnings)
- **Request:** None
- **Response:** `StaffQuery[]` array
- **Auth Required:** Yes (Admin)

### POST /api/staff-queries
- **Purpose:** Issue formal query to staff member
- **Request:** `{ staffId, staffName, department, reason, whyQuery, likelyPenalty, additionalNote?, attachmentPath? }`
- **Response:** Created `StaffQuery`
- **Auth Required:** Yes (Admin)

### PATCH /api/staff-queries/:id
- **Purpose:** Update query status
- **Request:** `{ status }`
- **Response:** Updated query
- **Auth Required:** Yes

### GET /api/staff-queries/has-updates
- **Purpose:** Check if staff member has queries
- **Request:** None
- **Response:** `{ hasUpdates: boolean }`
- **Auth Required:** Yes

### POST /api/staff-queries/test
- **Purpose:** Test staff query system (debug)
- **Request:** None
- **Response:** Test query created
- **Auth Required:** Yes (Admin)

---

## Notes

### GET /api/notes
- **Purpose:** Get user's personal notes
- **Request:** None
- **Response:** `Note[]` array
- **Auth Required:** Yes

### POST /api/notes
- **Purpose:** Create new note
- **Request:** `{ title?, content, type?, todoItems?, category? }`
- **Response:** Created `Note`
- **Auth Required:** Yes

### PUT /api/notes/:id
- **Purpose:** Update note
- **Request:** `{ title?, content?, type?, todoItems?, category? }`
- **Response:** Updated `Note`
- **Auth Required:** Yes

### DELETE /api/notes/:id
- **Purpose:** Delete note
- **Request:** None
- **Response:** `{ message: string }`
- **Auth Required:** Yes

---

## Stop-Gap System (Temporary Task Allocation)

### GET /api/stop-gap/current
- **Purpose:** Get current month's stop-gap allocation
- **Request:** None
- **Response:** `StopGapAllocation` for current month
- **Auth Required:** Yes (Staff)

### POST /api/stop-gap/apply
- **Purpose:** Apply stop-gap hours to task
- **Request:** `{ taskId, stopGapHours }`
- **Response:** `{ message, allocation }`
- **Auth Required:** Yes

### GET /api/stop-gap/task/:taskId
- **Purpose:** Get stop-gap assignment for task
- **Request:** None
- **Response:** `StopGapTaskAssignment` object
- **Auth Required:** Yes

---

## Reports & Analytics

### GET /api/productivity
- **Purpose:** Get productivity metrics for user or team
- **Request:** None
- **Response:** Productivity data with charts/statistics
- **Auth Required:** Yes

### GET /api/kpi-report/productivity
- **Purpose:** Get KPI productivity report
- **Request:** None
- **Response:** KPI data with metrics
- **Auth Required:** Yes (Admin)

### POST /api/kpi-report/export
- **Purpose:** Export KPI report as PDF/Excel
- **Request:** `{ format: 'pdf' | 'excel' }`
- **Response:** File download or file URL
- **Auth Required:** Yes (Admin)

### GET /api/staff-report
- **Purpose:** Get detailed staff report
- **Request:** None
- **Response:** Staff metrics and performance data
- **Auth Required:** Yes (Admin)

### GET /api/departments
- **Purpose:** Get list of all departments
- **Request:** None
- **Response:** `string[]` array of department names
- **Auth Required:** Yes

---

## Authentication Notes

**All API endpoints except explicitly marked "No"  require authentication via session cookie.**

**Authorization levels:**
- **Public:** `/api/public/users`, `/api/health/*`
- **Authenticated (any user):** Most endpoints
- **Project Member:** Team chat, resources
- **Project Manager:** Task creation, project updates, review submissions
- **Team Lead:** Review approval/rejection
- **Admin/Operations Manager:** User management, SOP management, complaint review, query issuance

**Error Responses:**
- `401 Unauthorized` — Not authenticated
- `403 Forbidden` — Insufficient permissions
- `400 Bad Request` — Invalid input
- `404 Not Found` — Resource not found
- `500 Internal Server Error` — Server error

---

# Prompt E: Authentication & Authorization System

## Overview

The application uses **Passport.js with Local Strategy** for session-based authentication (no JWT tokens). Sessions are stored in-memory with automatic cleanup every 24 hours. All sensitive operations are protected by checking `req.isAuthenticated()` before allowing access.

---

## User Registration System

### Registration Flow (Admin-Only)

1. **Admin Initiates Registration** (`POST /api/register`)
   - Only **Operations Managers**, **Team Leads**, or users with `specialization = "operations_manager"` can create accounts
   - Admin provides: username, email, name, role, and role-specific fields
   - System checks if username already exists (must be unique)

2. **Account Creation**
   - User record is created with `mustSetPassword: true` flag
   - Temporary password is generated (random 16-byte hex)
   - Password is hashed using **scrypt** with random 16-byte salt
   - Setup token is generated (random 32-byte hex) for one-time use
   - User status is set to `OFFLINE`
   - `passwordSetupToken` and `passwordSetupToken` expiration are stored

3. **Setup Email Sent**
   - Account setup email is sent with a link containing the setup token
   - Link format: `/setup-password?token=[setupToken]&username=[username]`
   - Email is sent via Gmail SMTP (via Nodemailer)

4. **User Sets Password** (`POST /api/setup-password`)
   - User clicks link in email, navigates to setup page
   - User enters username, setup token, and new password
   - System validates:
     - Token is present and valid
     - Token matches `passwordSetupToken` in database
     - `mustSetPassword` is true
     - New password is minimum 6 characters
   - Password is hashed and stored
   - `mustSetPassword` is set to false
   - `passwordSetupToken` is cleared

### Validation Rules

| Field | Validation |
|---|---|
| `username` | Minimum 3 characters, must be unique, case-insensitive |
| `password` | Minimum 6 characters |
| `email` | Valid email format |
| `role` | One of: `client`, `project_manager`, `staff`, `intern`, `customer_support_officer`, `operations_manager`, `team_lead` |
| `breakOneTime` | Required for all roles except `client`, format: "HH:mm" (e.g., "10:00") |
| `projectManagerType` | Required if role is `project_manager`, must be `main` or `supervisor` |
| `specialization` | Optional for staff/interns, one of department values (development, design, automation, etc.) |

---

## Login System

### Login Flow

1. **User Submits Credentials** (`POST /api/login`)
   - Frontend sends: `{ username, password }`
   - System validates both fields are provided

2. **LocalStrategy Authentication** (Passport)
   - Username is looked up in database (case-insensitive)
   - System checks:
     - User exists
     - User is active (`isActive = true`)
     - User doesn't have `mustSetPassword = true` (must have completed setup)
     - Password matches stored hash using `crypto.compare()`
   
3. **Validation Details**
   - Password hash is stored in format: `{128-char-hex-hash}.{32-char-hex-salt}`
   - Hash is compared using **timing-safe comparison** (`timingSafeEqual`) to prevent timing attacks
   - If password doesn't match, returns generic "Incorrect password" message
   - If account is deactivated, returns "Account has been deactivated"

4. **Session Creation**
   - User object is serialized to session (only user ID stored)
   - Session is saved to memory store
   - Session cookie `connect.sid` is set:
     - **Dev:** `secure: false` (HTTP), `httpOnly: true`, `sameSite: lax`
     - **Prod:** `secure: true` (HTTPS), `httpOnly: true`, `sameSite: lax`
   - **Cookie Max Age:** 14 days of inactivity (rolling: resets on each request)
   - **Cookie Name:** `connect.sid`

5. **Status Update** (Non-blocking)
   - User's status is updated to `ONLINE`
   - `lastActive` timestamp is recorded
   - Happens asynchronously, doesn't block login response

6. **Response**
   ```json
   {
     "message": "Login successful",
     "user": {
       "id": 1,
       "username": "john.doe",
       "role": "staff",
       "name": "John Doe"
     }
   }
   ```

### Error Handling

| Condition | Response | Status |
|---|---|---|
| Missing username/password | "Username and password are required" | 400 |
| User not found | "Incorrect username." | 401 |
| Account deactivated | "This account has been deactivated. Please contact an administrator." | 401 |
| Must set password first | "MUST_SET_PASSWORD" (special message) | 401 |
| Password mismatch | "Incorrect password." | 401 |
| Password verification error | "Password verification failed. Please try again." | 401 |
| Session save error | "Internal server error saving session" | 500 |

---

## Logout System

### Logout Flow (`POST /api/logout`)

1. **Status Update**
   - If user is authenticated, status updated to `OFFLINE`
   - `lastActive` timestamp recorded

2. **Session Destruction**
   - User is logged out via `req.logout()`
   - Session is destroyed
   - Session cookie `connect.sid` is cleared

3. **Response**
   ```json
   {
     "message": "Logout successful",
     "logoutOneSignal": true
   }
   ```
   - `logoutOneSignal: true` signals frontend to logout user from OneSignal push notifications

---

## Session Management

### Session Configuration

| Property | Value | Purpose |
|---|---|---|
| **Storage** | MemoryStore (in-process) | Sessions stored in server memory (not persistent) |
| **Secret** | `SESSION_SECRET` env var or `REPL_ID` | Used to sign session cookies |
| **Store Cleanup** | Every 24 hours (86400000ms) | Expired sessions are pruned automatically |
| **Max Age** | 14 days (1,209,600,000ms) | Session expires after 14 days of inactivity |
| **Rolling** | `true` | Session timeout resets on each request (sliding window) |
| **Secure** | Dev: `false`, Prod: `true` | HTTPS-only in production |
| **HttpOnly** | `true` | Cookie only accessible via HTTP, not JavaScript |
| **SameSite** | `lax` | CSRF protection, allows same-site and top-level navigation |
| **Path** | `/` | Cookie available to entire application |

### Session Serialization

```typescript
// Store only user ID in session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize by fetching full user from database on each request
passport.deserializeUser(async (id: number, done) => {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.isActive, true)))
    .limit(1);
  done(null, user);
});
```

**Strategy:** Only user ID stored in session; full user object fetched from database on each request. This ensures:
- Session size is minimal
- User data is always current
- Deactivated users are immediately logged out
- Role/permission changes take effect immediately

### Session Secret Management

| Environment | Secret Source | Fallback |
|---|---|---|
| **Production** | `SESSION_SECRET` env var | `REPL_ID` (Replit-injected) |
| **Development** | `REPL_ID` or fallback-secret | hardcoded fallback string |

**Security:** If production environment detected but no session secret found, a warning is logged recommending manual setup.

---

## Password Management

### Password Hashing

**Algorithm:** Node.js built-in `crypto.scrypt` with random salt

**Process:**
1. Generate random 16-byte salt
2. Derive 64-byte key from password using scrypt
3. Convert both to hex strings
4. Store as: `{hash}.{salt}` (128-char hex hash + dot + 32-char hex salt)

**Hash Example:**
```
a1b2c3d4e5f6...f7e8d9c0a1b2c3d4e5f6g7h8i9j0k1l2m3n4.0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5
```

### Password Comparison

Uses **timing-safe comparison** (`crypto.timingSafeEqual`) to prevent timing attacks:
1. Split stored password to extract hash and salt
2. Hash supplied password with extracted salt
3. Compare using timing-safe function (constant-time comparison)

**Validation:** Hash and salt lengths are verified before comparison:
- Hash must be exactly 128 hex characters (64 bytes)
- Salt must be exactly 32 hex characters (16 bytes)

---

## Password Reset System

### Forgot Password Flow (`POST /api/forgot-password`)

1. **Identity Verification**
   - User provides email and username
   - System queries database for matching user (active only)
   - If no match found, returns generic message (doesn't leak user existence)

2. **Token Generation**
   - Reset token generated (random 32-byte hex string)
   - Token expiration set to 1 hour from now
   - Token and expiration stored in database
   - Previous tokens are overwritten

3. **Email Sent**
   - Password reset email sent with reset token
   - Email contains link to reset form with token

### Reset Password Flow (`POST /api/reset-password`)

1. **Token Validation**
   - User provides reset token and new password
   - System queries for user matching token
   - Token must not be expired (checked with `resetPasswordExpires > now`)
   - If token invalid or expired, returns "Invalid or expired reset token"

2. **Password Update**
   - New password is hashed
   - Stored in database
   - Reset token and expiration are cleared

3. **Response**
   ```json
   {
     "message": "Password has been reset successfully"
   }
   ```

---

## Email Verification System

### Email Verification Flow (`GET /api/verify-email/:token`)

1. **Token Validation**
   - Token parameter extracted from URL
   - User with matching `verificationToken` looked up

2. **Verification**
   - If token found, `emailVerified` set to true
   - Verification token cleared from database
   - Returns success message

**Current Status:** Email verification is implemented but not actively enforced. Users can bypass email verification and still access the system.

---

## Protected Routes

### Route Protection Pattern

```typescript
// Authentication check
if (!req.isAuthenticated()) {
  return res.status(401).send("Not authenticated");
}

// Optional role check
if (req.user!.role !== "operations_manager") {
  return res.status(403).send("Insufficient permissions");
}
```

### Fully Protected Routes (Requires Authentication)

All API routes except the following require authentication:
- `POST /api/login`
- `POST /api/register` (requires auth but is admin-only)
- `POST /api/setup-password`
- `POST /api/forgot-password`
- `POST /api/reset-password`
- `GET /api/verify-email/:token`
- `GET /api/health/*`
- `GET /api/public/users`

### Public Routes (No Authentication Required)

```
GET  /api/health/session          — Check session status
GET  /api/health/database         — Check database connection
GET  /api/public/users            — Get list of all active users
POST /api/login                   — Login endpoint
POST /api/setup-password          — Initial password setup
POST /api/forgot-password         — Start password reset
POST /api/reset-password          — Complete password reset
GET  /api/verify-email/:token    — Verify email with token
```

---

## Role-Based Authorization

### User Roles

The system defines 8 distinct user roles stored in `users.role`:

| Role | Description | Permissions |
|---|---|---|
| `operations_manager` | Top-level administrator | Create users, send memos, manage all system functions |
| `team_lead` | Team leadership/supervisor | Review links, approve/reject work, manage team |
| `project_manager` | Project management (with sub-type) | Create/manage projects, assign tasks, manage teams |
| `product_owner` | Product strategy | View projects, define requirements |
| `staff` | General employee | Work on assigned tasks, view projects, create notes |
| `intern` | Intern/trainee | Work on assigned tasks, limited access |
| `customer_support_officer` | Customer support specialist | Manage support requests, view client issues |
| `client` | External client | Limited access, view assigned projects only |

### Sub-Types

Some roles have sub-types for more granular control:

**Project Manager Types:**
- `main` — Primary project manager with full authority
- `supervisor` — Supervises other project managers

**Staff Specializations:**
- `development`, `design`, `automation`, `copywriting`, `media_buying`, `community_manager`, `technical_support`, `replit_development`, etc.
- Optional for staff/interns, determines department assignment for memos

**Client Types:**
- `project_client` — Client receiving project work
- `support_maintenance_client` — Client with ongoing support contract

### Authorization Examples

**Create Users (Admin-Only)**
```typescript
if (currentUser.role !== "operations_manager" && 
    currentUser.role !== "team_lead" && 
    currentUser.specialization !== "operations_manager") {
  return res.status(403).send("Only operations managers and team leads can create accounts");
}
```

**Start Task Timer (Staff-Only)**
```typescript
if (!req.isAuthenticated() || 
    (req.user!.role !== "staff" && 
     req.user!.role !== "intern" && 
     req.user!.role !== "team_lead")) {
  return res.status(403).send("Insufficient permissions");
}
```

**Memo Recipient Filtering (Non-Managers)**
```typescript
// For non-managers: fetch only memos sent to them
GET /api/memos/my-memos

// For managers: fetch all memos
GET /api/memos
```

### Permission Patterns

**Operations Manager/Team Lead (Highest Permissions)**
- Create and manage users
- Create and send memos
- Review and approve work
- Access all reporting dashboards
- Manage SOPs, review links, project briefings
- Issue formal staff queries

**Project Manager (Medium-High Permissions)**
- Create and manage projects
- Assign and manage tasks
- Create project plans and deliverables
- Submit links for review
- View team performance
- Cannot create users or send system memos

**Staff/Interns (Medium Permissions)**
- View assigned projects and tasks
- Start/stop task timers
- Submit tasks for review
- Create personal notes
- Apply for leave
- Submit complaints/issues
- Cannot create projects or manage users

**Clients (Low Permissions)**
- View assigned projects (limited)
- View project details
- Submit sentiment feedback
- Cannot create projects or manage other users

**Customer Support Officer (Special)**
- View support requests
- Manage technical support tickets
- Cannot manage users or projects

---

## User Status & Presence

### User Status Fields

| Field | Type | Values | Purpose |
|---|---|---|---|
| `status` | enum | `online`, `offline`, `idle` | Real-time presence indicator |
| `workStatus` | enum | `active`, `on_break`, `absent` | Work availability status |
| `lastActive` | timestamp | — | When user last made a request |
| `lastSeen` | timestamp | — | When user was last seen online |

### Status Management

**Online Status Update**
- Updated to `ONLINE` when user logs in
- Updated to `OFFLINE` when user logs out
- Updated to `ONLINE` and `lastActive` refreshed on each request

**Work Status Update**
- Manually set by user or team lead
- Affects task assignment and notifications
- Used for break reminders and time tracking

### Deactivation

Users can be soft-deleted (deactivated) via `users.isActive` flag:
- Deactivated users cannot login
- Deactivated users are immediately logged out if already authenticated
- Deactivated status checked on every session deserialization
- Cannot be directly deactivated by themselves; requires admin action

---

## Security Features

### Protection Mechanisms

| Feature | Implementation |
|---|---|
| **Password Hashing** | Scrypt with 16-byte random salt, 64-byte derived key |
| **Timing-Safe Comparison** | `crypto.timingSafeEqual` for hash verification |
| **Session Security** | HttpOnly cookies, SameSite lax, Secure flag in production |
| **CSRF Protection** | SameSite lax (prevents cross-site form submission) |
| **Account Lockout** | Deactivated accounts cannot login |
| **Token Expiration** | Reset tokens expire in 1 hour |
| **Generic Error Messages** | Don't reveal if email/username exists |
| **Input Validation** | Zod schemas for login/register data |
| **SQL Injection Prevention** | Drizzle ORM parameterized queries |
| **XSS Prevention** | React DOM escapes output by default |

### NOT Implemented (Gaps)

- **Rate Limiting:** No login attempt rate limiting; brute force attacks possible
- **Account Lockout:** No temporary lockout after failed attempts
- **Two-Factor Authentication (2FA):** Not implemented
- **Password Complexity:** Minimum 6 characters only; no complexity requirements
- **Audit Logging:** No login/logout logs stored
- **Session Revocation:** Cannot invalidate existing sessions (only on restart)
- **OAuth/Social Login:** No external authentication providers
- **Passwordless Auth:** No magic links or passwordless methods

---

## Frontend Authentication

### Authentication Hook

Frontend uses custom `useAuth` hook (in `client/src/hooks/use-auth.ts`):

```typescript
const { user, isLoading, loginMutation, logoutMutation } = useAuth();

// Check authentication status
if (!user) {
  return <Redirect to="/auth" />;
}

// Login
await loginMutation.mutateAsync({ username, password });

// Logout
await logoutMutation.mutateAsync();
```

### Protected Routes (Frontend)

Routes protected via `<PrivateRoute>` wrapper:
- Redirects unauthenticated users to `/auth`
- Shows loading state while checking session

### API Request Credentials

All API requests include session cookie automatically:
- Credentials sent via `fetch(url, { credentials: 'include' })`
- Browser handles `connect.sid` cookie automatically
- No additional token headers needed

---

## Environment Variables

| Variable | Required | Impact |
|---|---|---|
| `SESSION_SECRET` | Recommended | Secret used to sign session cookies. If not set, falls back to `REPL_ID` or hardcoded value. |
| `DATABASE_URL` | **Required** | PostgreSQL connection string. Server won't start without it. |
| `NODE_ENV` | Optional | If set to `production`, enables secure cookies and other prod settings. |
| `REPLIT_DEPLOYMENT` | Auto (Replit) | Set to `"1"` by Replit in deployed environments. Triggers production mode. |

---

## Authentication Flow Diagrams

### Login Flow
```
User (Browser)
    ↓
[Enter username/password]
    ↓
POST /api/login
    ↓
[Validate input]
    ↓
[Lookup user in DB]
    ↓
[Compare password hash]
    ↓
[Create session]
    ↓
[Set cookie: connect.sid]
    ↓
[Update user status to ONLINE]
    ↓
Return: { user, message }
    ↓
User authenticated ✅
```

### Registration Flow (Admin Creates User)
```
Admin (Authenticated)
    ↓
POST /api/register with user data
    ↓
[Verify admin role]
    ↓
[Validate input schema]
    ↓
[Hash temporary password]
    ↓
[Generate setup token]
    ↓
[Create user in DB with mustSetPassword=true]
    ↓
[Send setup email with token]
    ↓
New user receives email
    ↓
[Click setup link]
    ↓
POST /api/setup-password with token and new password
    ↓
[Hash new password]
    ↓
[Update user: clear mustSetPassword, save hash]
    ↓
User can now login ✅
```

### Password Reset Flow
```
Forgot Password (Unauthenticated)
    ↓
POST /api/forgot-password with email + username
    ↓
[Lookup user in DB]
    ↓
[Generate reset token]
    ↓
[Set token expiration to 1 hour]
    ↓
[Send reset email with token]
    ↓
User receives email
    ↓
[Click reset link]
    ↓
POST /api/reset-password with token + new password
    ↓
[Validate token not expired]
    ↓
[Hash new password]
    ↓
[Update user: save new hash, clear token]
    ↓
User can login with new password ✅
```

---

# Prompt F: Environment Variables & Configuration

## All Environment Variables

### Backend Environment Variables (Node.js)

| Variable | Required | Service | Purpose | Example |
|---|---|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL (Neon) | Development database connection string | `postgresql://user:pass@host/dbname` |
| `PRODUCTION_DATABASE_URL` | No | PostgreSQL (Neon) | Production database connection string (overrides DATABASE_URL in prod) | `postgresql://user:pass@host/dbname` |
| `SESSION_SECRET` | Recommended | Express-Session | Secret key for signing session cookies | Any random string (32+ chars recommended) |
| `ONESIGNAL_APP_ID` | For Push Notifications | OneSignal | OneSignal app identifier for push notifications | `12345678-abcd-efgh-ijkl-mnopqrstuvwx` |
| `ONESIGNAL_REST_API_KEY` | For Push Notifications | OneSignal | OneSignal REST API authentication key | `ZWU1ZTA5YTItOGI4Yi00ZTc5...` |
| `GMAIL_USER` | For Email | Gmail SMTP | Gmail account for sending emails | `your-email@gmail.com` |
| `GMAIL_APP_PASSWORD` | For Email | Gmail SMTP | Gmail app-specific password (not regular password) | 16-character app password |
| `APP_URL` | Optional | Email Links | Base URL for email links (verification, password reset) | `https://myapp.replit.dev` or `https://example.com` |
| `NODE_ENV` | Optional | Express | Application environment mode | `development` or `production` |
| `REPLIT_DEPLOYMENT` | Auto (Replit) | Replit | Automatically set by Replit when deployed | `1` (when deployed) or not set |

### Replit Auto-Injected Variables (Read-Only)

These variables are automatically provided by Replit and should not be manually set:

| Variable | Source | Purpose |
|---|---|---|
| `REPL_ID` | Replit | Unique identifier for the Repl (used as fallback SESSION_SECRET) |
| `REPL_OWNER` | Replit | Username of Repl owner |
| `REPL_SLUG` | Replit | Repl slug/name |
| `REPLIT_DEV_DOMAIN` | Replit | Development domain for Replit-hosted apps (e.g., `myapp.replit.dev`) |

### Frontend Environment Variables (Vite)

Frontend variables must be prefixed with `VITE_` to be accessible in client code via `import.meta.env`.

| Variable | Required | Service | Purpose | Usage |
|---|---|---|---|---|
| `VITE_ONESIGNAL_APP_ID` | For Push Notifications | OneSignal | OneSignal app ID for client-side push initialization | `import.meta.env.VITE_ONESIGNAL_APP_ID` |

**Note:** Frontend env vars must be set in Replit Secrets with `VITE_` prefix to be injected by Vite at build time.

---

## Configuration Files

### `drizzle.config.ts`
- **Purpose:** Drizzle ORM configuration for database migrations
- **Database Selection:** 
  - Uses `PRODUCTION_DATABASE_URL` if `NODE_ENV === 'production'`
  - Falls back to `DATABASE_URL` if production URL not set
  - Throws error if neither is configured
- **Schema Location:** `db/schema.ts`
- **Migrations Directory:** `migrations/`
- **Dialect:** PostgreSQL

### `vite.config.ts`
- **Purpose:** Frontend build configuration (React + Vite)
- **Plugins:** 
  - React JSX transformer
  - Shadcn theme plugin
  - Replit runtime error overlay
- **Aliases:**
  - `@` → `client/src/`
  - `@db` → `db/`
- **Build Output:** `dist/public/`
- **Root:** `client/` directory

### `tailwind.config.ts`
- **Purpose:** Tailwind CSS styling configuration
- **Theme Integration:** Reads from `theme.json` (Replit Shadcn theme)

### `postcss.config.js`
- **Purpose:** PostCSS configuration for CSS preprocessing
- **Used by:** Tailwind CSS

### `.env.example`
- **Purpose:** Template for environment variables
- **Current Contents:**
  ```
  # OneSignal Configuration
  ONESIGNAL_APP_ID=your_onesignal_app_id_here
  ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key_here
  
  # Client-side OneSignal (for Vite)
  VITE_ONESIGNAL_APP_ID=your_onesignal_app_id_here
  ```
- **Note:** File is incomplete; missing DATABASE_URL, GMAIL, SESSION_SECRET documentation

---

## External Services & API Keys

### 1. OneSignal (Push Notifications)

**Service:** Push notification platform for web and mobile

**Requires:**
- `ONESIGNAL_APP_ID` (backend)
- `ONESIGNAL_REST_API_KEY` (backend)
- `VITE_ONESIGNAL_APP_ID` (frontend)

**Setup:**
1. Create account at [https://onesignal.com](https://onesignal.com)
2. Create a new web push application
3. Get App ID from App Settings
4. Get REST API Key from Settings → Keys & IDs
5. Add both to Replit Secrets

**Usage in App:**
- Backend: `POST` to OneSignal REST API to send notifications
- Frontend: Initialize OneSignal SDK, register for push notifications
- Real-time notifications for task assignments, mentions, direct messages, memo responses

**Endpoints Called:**
- `POST https://onesignal.com/api/v1/notifications`

**Fallback:** If not configured, app logs warning but continues to work (notifications just won't be sent)

### 2. Gmail SMTP (Email Service)

**Service:** Gmail account for sending transactional emails

**Requires:**
- `GMAIL_USER` (email address)
- `GMAIL_APP_PASSWORD` (not regular Gmail password)

**Setup:**
1. Enable 2-Factor Authentication on Gmail account
2. Generate App Password:
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Click "App passwords" (under 2-Step Verification)
   - Select "Mail" and "Windows Computer"
   - Copy 16-character password
3. Add to Replit Secrets:
   - `GMAIL_USER`: your email address
   - `GMAIL_APP_PASSWORD`: the 16-char password

**Usage in App:**
- Account setup emails (new user password setup link)
- Password reset emails
- Email verification emails

**Fallback:** If Gmail not configured, app uses Ethereal (fake SMTP for development)
- Works in development but emails not actually sent
- In production without Gmail, email system will fail

**Email Templates:**
- From: `"wcdigital worktool app" <noreply@wcdigital.com>`
- Subject: Auto-generated based on email type
- HTML templates with links and formatting

### 3. PostgreSQL / Neon (Database)

**Service:** PostgreSQL database hosted on Neon (or self-hosted)

**Requires:**
- `DATABASE_URL` (development)
- `PRODUCTION_DATABASE_URL` (production, optional if using single URL)

**Setup:**
1. Create account at [https://neon.tech](https://neon.tech)
2. Create new project
3. Get connection string from dashboard
4. Connection string format: `postgresql://[user]:[password]@[host]/[database]?sslmode=require`
5. Add to Replit Secrets as `DATABASE_URL`

**Usage:**
- All data persistence (users, projects, tasks, messages, etc.)
- 37 tables with complex relationships
- Drizzle ORM for queries and migrations

**Required Tables:**
- All 37 tables must exist (see Prompt C for full schema)
- Migrations run automatically on startup

**Connection Details:**
- Driver: `postgres.js` (via Drizzle)
- Connection pooling: Automatic
- SSL: Required for Neon (sslmode=require)

---

## How Environment Variables Are Loaded

### Development (Replit)

1. **Replit Secrets:** Automatically injected into process environment
   - Access via `process.env.VARIABLE_NAME` in backend
   - Access via `import.meta.env.VITE_VARIABLE_NAME` in frontend
   - No `.env` file needed; secrets are secure

2. **Auto-Injected by Replit:**
   - `REPL_ID`, `REPL_OWNER`, `REPL_SLUG`
   - `REPLIT_DEV_DOMAIN` (only if app is deployed/shared)

3. **Fallbacks:**
   - `SESSION_SECRET` fallback: `REPL_ID` → hardcoded string
   - `APP_URL` fallback: `REPLIT_DEV_DOMAIN` → `http://localhost:5000`

### Production (Deployed)

1. **Environment Variables:** Set in production environment
   - Replit: Settings → Environment Variables
   - VPS/Docker: Set in `.env` or orchestration platform
   - MUST include `NODE_ENV=production`

2. **Replit Deployment Detection:**
   - If `REPLIT_DEPLOYMENT=1` (auto-set when deployed), app runs in production mode
   - Or if `NODE_ENV=production`

3. **Production-Specific Changes:**
   - Session cookies set to `secure: true` (HTTPS only)
   - Database URL uses `PRODUCTION_DATABASE_URL` if available
   - Error messages less verbose in API responses

---

## Security Notes

### Never Commit Secrets

- **DO NOT** add `.env` files with secrets to git
- **DO NOT** add secrets to code
- **Use Replit Secrets** for all sensitive data:
  - Database URLs
  - API keys
  - Session secrets
  - Email passwords

### Replit Secrets Management

Access via **Secrets (lock icon)** in Replit Tools panel:
1. Click lock icon
2. Click "Create Secret"
3. Enter key (e.g., `ONESIGNAL_APP_ID`)
4. Enter value (never visible once saved)
5. Available immediately to running code

### Session Secret in Production

- **Recommended:** Set explicit `SESSION_SECRET` in Replit Secrets (32+ random characters)
- **Current Fallback:** Uses `REPL_ID` (Replit-generated) if not set
- **Issue:** If Replit restarts and REPL_ID changes, old sessions become invalid
- **Solution:** Set fixed `SESSION_SECRET` for persistent sessions across restarts

### Email Security

- Gmail password should be **app-specific password**, NOT account password
- If account password used, may fail with "Less secure app access" error
- App password can be revoked without changing Gmail password

### Database Security

- PostgreSQL connection requires SSL (`sslmode=require`)
- Password embedded in connection string
- Never log full connection string (preview only)
- Neon provides automatic backups and security

---

## Startup Validation

When server starts, it logs:

```
🔧 Session Configuration:
  - Environment: production/development
  - NODE_ENV: value or not set
  - REPLIT_DEPLOYMENT: value or not set
  - Trust proxy: 1
  - Session secret source: SESSION_SECRET/REPL_ID/fallback
  - Cookie secure: true/false
  - DATABASE_URL: configured/NOT SET
  - PRODUCTION_DATABASE_URL: configured/NOT SET

🔧 OneSignal Configuration:
  - appIdConfigured: true/false
  - restApiKeyConfigured: true/false
  - configurationValid: true/false
  - ⚠️ OneSignal is NOT properly configured! (if missing)

📧 Initializing Email Service:
  - Gmail SMTP service (if GMAIL_USER/GMAIL_APP_PASSWORD set)
  - OR Ethereal test email service (fallback)
```

### Common Issues & Fixes

| Issue | Cause | Fix |
|---|---|---|
| "DATABASE_URL must be set" | Missing database connection | Set `DATABASE_URL` in Replit Secrets |
| Emails not sending | Gmail not configured | Add `GMAIL_USER` and `GMAIL_APP_PASSWORD` to Secrets |
| Sessions lost on restart | No fixed `SESSION_SECRET` | Set explicit `SESSION_SECRET` in Secrets |
| Notifications not sent | OneSignal not configured | Set `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY` |
| "Less secure app access" on email | Using account password instead of app password | Generate app-specific password in Gmail |
| Production mode detection wrong | Both `NODE_ENV` and `REPLIT_DEPLOYMENT` unset | Set `NODE_ENV=production` in Secrets |

---

## Total Environment Variables Summary

| Category | Count | Type |
|---|---|---|
| Backend Required | 1 | `DATABASE_URL` |
| Backend Optional | 8 | Session, Email, Services |
| Frontend Optional | 1 | `VITE_ONESIGNAL_APP_ID` |
| Replit Auto-Injected | 4 | Read-only |
| **Total** | **14** | — |

**Critical for startup:** `DATABASE_URL` only
**Critical for features:**
- Email system: `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- Push notifications: `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`
- Secure sessions: `SESSION_SECRET` (optional but recommended)

---

# Prompt G: UI Components & Pages Architecture

## State Management Strategy

### Primary State Management Tools

| Tool | Usage | Purpose |
|---|---|---|
| **`useState`** | 383+ uses | React built-in for component-level state (filters, modals, form inputs, etc.) |
| **`useContext`** | 11 uses | Context API for app-wide state (auth, theme) |
| **`@tanstack/react-query`** | Server state | Data fetching, caching, synchronization with backend |

### State Management Patterns

**Component State (useState)**
- Form inputs and validations
- Modal/dialog open/close state
- UI filters and sorting
- Temporary UI state (expanded sections, hovered items)
- Search queries and pagination

**Context API**
- User authentication (`AuthContext`)
- Theme (light/dark mode via `ThemeProvider`)
- Global notification/toast state (via `useToast` hook)

**React Query**
- Fetching and caching API data (`useQuery`)
- Mutations (create, update, delete) (`useMutation`)
- Automatic invalidation and refetching
- Optimistic updates
- Caching strategies with staleTime and gcTime

### Custom Hooks (Domain-Specific State)

| Hook | Purpose | Returns |
|---|---|---|
| `useAuth()` | Authentication state (user, login/logout) | `{ user, isLoading, loginMutation, logoutMutation }` |
| `useUser()` | Current user profile | `{ user }` |
| `useWebSocket()` | Real-time WebSocket communication | `{ updateStatus, sendMessage }` |
| `useQuery()` | Server state with caching | `{ data, isLoading, error, refetch }` |
| `useMutation()` | Create/update/delete operations | `{ mutate, mutateAsync, isLoading }` |
| `useNotificationSound()` | Audio notification management | `{ playNotificationSound, isUnlocked }` |
| `useBrowserNotification()` | Browser push notifications | `{ showNotification }` |
| `useOneSignal()` | OneSignal push initialization | Sets up push notifications |
| `useToast()` | Toast notifications | `{ toast }` method |
| `useUnreadMessages()` | Message count tracking | `{ unreadCount }` |
| `useSidebarIndicators()` | Badge indicators for sidebar | Update counts |
| `useTheme()` | Theme management | `{ theme, setTheme }` |

---

## Core Layout Components

### Header (`/components/dashboard/header.tsx`)

**Purpose:** Top navigation bar visible on all dashboard pages

**Features:**
- User profile dropdown (name, email, logout)
- Notification bell with dropdown (shows recent notifications)
- Direct message icon with count
- Unread message list in dropdown
- Theme toggle (light/dark mode)
- Audio notification unlock button

**State Managed:**
- Notification dropdown open/close
- Unread messages list
- Theme preference

**Sub-Components Used:**
- `NotificationsDropdown` — Displays recent notifications
- `DropdownMenu` (shadcn/ui) — Profile and menu dropdowns
- `Badge` — Shows unread counts
- `ThemeToggle` — Dark mode switcher
- `ScrollArea` — Scrollable unread messages list

**Data Sources:**
- `GET /api/user` — Current user profile
- `GET /api/notifications` — User notifications
- `GET /api/projects/unread-counts` — Unread team chat counts
- WebSocket events for real-time updates

---

### Sidebar (`/components/dashboard/sidebar.tsx`)

**Purpose:** Left navigation panel with links to all major features

**Features:**
- Dynamic menu based on user role
- Badge indicators (red dots) for unread items
- Responsive: collapses to mobile menu on small screens
- Smooth animations and transitions
- Visual indicators for current page (active link highlighting)

**Menu Sections (Role-Based):**

**All Users:**
- Dashboard
- Projects
- Tasks
- Direct Messages (count badge)
- General Channel (count badge)
- Bookings
- Notes
- Profile
- Reach Us

**Staff/Interns:**
- Leave Application
- Complaints
- Technical Support
- Deadline Extension Requests
- StaffQueries

**Project Managers:**
- Review Links (count badge)
- KPI Report
- Staff Report

**Operations Manager/Team Lead:**
- User Control
- Client Accounts
- Client Management
- SOPs
- Memos (count badge)
- Staff Complaints
- Issue Reports
- Report Management

**Clients:**
- Client Dashboard
- Client Sentiment (count badge)
- Reach Us

**Data Fetched:**
- User role and permissions
- Unread message counts per category
- Update indicators (new items pending action)

**State Managed:**
- Mobile menu open/close
- Active link tracking
- Badge count updates

---

## Page Architecture

### Dashboard Structure (All Pages)

Most dashboard pages follow this layout:

```
┌─────────────────────────────────────────┐
│           HEADER (Top Nav)              │
├──────────┬──────────────────────────────┤
│          │                              │
│ SIDEBAR  │      PAGE CONTENT            │
│ (Left)   │      (Responsive Grid)       │
│          │                              │
└──────────┴──────────────────────────────┘
```

---

## Main Pages Overview

### 1. Home Dashboard (`/dashboard` or `/`)

**Purpose:** Main landing page after login, shows user overview

**Layout:**
- Collapsible sections for different task statuses (To Do, In Progress, Review, Completed)
- Quick project cards
- Upcoming tasks list
- Meeting/booking alerts
- Stop-gap allocation card (temporary task hours)
- Date range picker for filtering

**Components Used:**
- `ProjectCard` — Display project overview
- `TaskList` / `StaffTaskList` — Task cards
- `ChatWindow` — Quick messaging
- `Collapsible` — Expandable sections
- `Calendar` — Date range selector
- `MeetingAlert` — Upcoming meetings
- `BookingAlert` — Upcoming bookings
- `StopGapCard` — Temporary task allocation

**State:**
- Task search query
- Date filter (single date or range)
- Open/closed sections per status
- Expanded descriptions

**Data Fetched:**
- `GET /api/projects` — All projects (refetch every 5s)
- `GET /api/tasks` — User's tasks
- `GET /api/staff` — Staff names for assignees
- `GET /api/bookings/my-upcoming` — Upcoming bookings
- `GET /api/stop-gap/current` — Current stop-gap allocation

**Real-Time Features:**
- WebSocket events for task updates
- SSE notifications
- Automatic query invalidation on changes

---

### 2. Projects (`/dashboard/projects`)

**Purpose:** View and manage all projects

**Layout:**
- Search and filter bar (by name, status)
- Status filter dropdown (All, Active, Completed, On Hold, etc.)
- Grid/card view of projects
- Create Project button (for Project Managers)
- Edit/Delete project options

**Components Used:**
- `ProjectCard` — Project display card with status badge
- `Dialog` — Create/Edit project form
- `AlertDialog` — Delete confirmation
- `ProjectForm` — Form for creating/editing projects
- `Select` — Status filter dropdown
- `Input` — Search input
- `Collapsible` — Optional section grouping

**State:**
- Search query
- Status filter
- Dialog open/close (create/edit modes)
- Currently editing project (for edit dialog)

**Data Fetched:**
- `GET /api/projects` — All projects
- `POST /api/projects` — Create project
- `PUT /api/projects/:id` — Update project
- `DELETE /api/projects/:id` — Delete project

---

### 3. Tasks (`/dashboard/tasks`)

**Purpose:** View and manage all assigned tasks

**Layout:**
- Filter by status (All, To Do, In Progress, Review, Completed)
- Project filter dropdown
- Search by task title
- Date range picker
- Task list cards with details

**Components Used:**
- `TaskList` — Main task list renderer
- `Select` — Status and project filters
- `Input` — Search field
- `Calendar` — Date range picker
- `Popover` — Date picker popup
- `Badge` — Status badges

**State:**
- Filter (status)
- Selected project ID
- Search query
- Date range

**Data Fetched:**
- `GET /api/tasks` — All assigned tasks
- Task updates via WebSocket

**Filtering Logic:**
- Search by title
- Filter by status
- Filter by project
- Filter by date range

---

### 4. Project Details (`/dashboard/projects/:id`)

**Purpose:** View full project information and sub-pages

**Sub-Routes:**
- `/dashboard/projects/:id` — Main overview
- `/dashboard/projects/:id/tasks` — Project tasks
- `/dashboard/projects/:id/team` — Team members
- `/dashboard/projects/:id/resources` — Files and links
- `/dashboard/projects/:id/plans` — Project plans and deliverables

**Layout (Main View):**
- Project header (name, status, progress bar)
- Tabs for different sections
- Project metadata (client, dates, manager)
- Quick actions (complete project, edit, delete)

**Components Used:**
- `Tabs` — Section navigation
- `Card` — Information cards
- `Badge` — Status and team badges
- `Button` — Action buttons
- `Progress` — Progress bar
- Dialog components for editing

**Data Fetched:**
- `GET /api/projects/:id` — Full project details
- `GET /api/projects/:id/members` — Team members
- `GET /api/projects/:id/tasks` — Project tasks
- `GET /api/projects/:id/plans` — Project plans
- `GET /api/projects/:id/resources` — Resources

---

### 5. Team Chat (`/dashboard/projects/:id/team-chat`)

**Purpose:** Real-time team messaging for a specific project

**Layout:**
- Message list (scrollable, auto-scroll to bottom)
- Message input box at bottom
- Unread count indicator
- Read receipts (who read the message)

**Components Used:**
- `ChatWindow` — Chat interface
- `Input` — Message input
- `Button` — Send button
- `ScrollArea` — Scrollable messages
- `Avatar` — User avatars
- Badge for read receipt count

**State:**
- Message list
- Current input text
- Auto-scroll flag
- Read receipt modal

**Data Fetched:**
- `GET /api/projects/:projectId/team-messages` — Messages
- `POST /api/projects/:projectId/team-messages` — Send message
- WebSocket for real-time messages

---

### 6. Direct Messages (`/dashboard/direct-messages`)

**Purpose:** One-on-one private messaging

**Layout:**
- Conversation list (left sidebar or dropdown on mobile)
- Active conversation view (center)
- Message list with avatars
- Input box for new messages
- Unread badges

**Components Used:**
- `DirectMessages` — Main DM component
- `ChatWindow` — Chat interface
- `Avatar` — User profile pictures
- `Card` — Conversation cards
- `Input` — Message input

**State:**
- Selected user/conversation
- Messages list
- Input text

**Data Fetched:**
- `GET /api/direct-messages/conversations` — List of conversations
- `GET /api/direct-messages/:userId` — Messages with specific user
- `POST /api/direct-messages` — Send message
- `PUT /api/direct-messages/:userId/read` — Mark as read

---

### 7. General Channel (`/dashboard/general-channel`)

**Purpose:** Company-wide announcement and discussion channel

**Layout:**
- Message feed (reverse chronological)
- Pin indicator for pinned messages
- Reaction emojis on messages
- Message actions (edit, delete, pin)

**Components Used:**
- Chat message display
- `Input` — Message input
- Reaction emoji picker
- Message action menu

**Features:**
- Emoji reactions on messages
- Pin/unpin messages (admin only)
- Edit messages (owner only)
- Delete messages (owner or admin)

**Data Fetched:**
- `GET /api/general-channel/messages` — All channel messages
- `POST /api/general-channel/messages` — Send message
- `POST /api/general-channel/messages/:id/react` — Add reaction

---

### 8. Memos (`/dashboard/memos`)

**Purpose:** Broadcast messages from management to staff

**Layout (Manager View):**
- Create memo button
- List of sent memos
- Response count and list

**Layout (Staff/Other View):**
- List of memos addressed to user/department
- Memo details modal
- Response input form (one per user)
- Read receipts

**Components Used:**
- `Dialog` — Memo creation/detail modal
- `Card` — Memo card display
- `Form` — Response submission form
- `Badge` — New/unread indicator
- `Tabs` — Manager vs. staff views

**State:**
- Memo search/filter
- Selected memo (for detail view)
- Response form state

**Data Fetched:**
- `GET /api/memos` — User's memos
- `POST /api/memos` — Send memo (manager only)
- `GET /api/memos/:id/responses` — Memo responses
- `POST /api/memos/:id/responses` — Submit response

---

### 9. Leave Management (`/dashboard/leave-application`)

**Purpose:** Request and manage time off

**Layout:**
- Application form (date range, reason, proof image upload)
- Status display (pending, approved, rejected)
- Historical leave records
- Approval status badge

**Components Used:**
- `Form` (react-hook-form) — Leave request form
- `Input`, `Textarea` — Form fields
- File upload — Proof image
- `Calendar` — Date range picker
- `Card` — Leave history cards
- `Badge` — Status badges

**State:**
- Form submission state
- Selected dates
- Uploaded image preview

**Data Fetched:**
- `POST /api/leave-applications` — Submit leave request
- `GET /api/leave-applications` — User's leave history
- `PUT /api/leave-applications/:id/review` — Review request (manager)

---

### 10. Technical Support (`/pages/technical-support`)

**Purpose:** Report technical issues and get support

**Layout:**
- Support request form
- Submitted requests list
- Assignment status (assigned to / assigned by)
- Resolution field

**Components Used:**
- `Form` — Submission form
- `Select` — Priority dropdown
- `Textarea` — Description
- `Card` — Request display
- Modal for request details

**State:**
- Form state
- Filter (open/resolved)

**Data Fetched:**
- `POST /api/technical-support/requests` — Submit request
- `GET /api/technical-support/requests` — List requests

---

### 11. Review Links (`/dashboard/review-links`)

**Purpose:** Submit work for review (project managers submit, team leads approve)

**Layout:**
- Create review link form (Project Managers)
- Link list with status (pending, reviewed, not_approved, needs_revision)
- Approval/rejection interface (Team Leads)
- Comment/feedback section

**Components Used:**
- `Dialog` — Create link form
- `Form` — Review form
- `Textarea` — Comments
- `Badge` — Status badges
- `Button` — Action buttons (approve, reject, comment)
- `Card` — Link display

**Status Values:**
- `pending` — Awaiting review
- `reviewed` — Approved
- `not_approved` — Rejected
- `needs_revision` — Needs changes

**Data Fetched:**
- `POST /api/review-links` — Submit for review
- `GET /api/review-links` — List all links
- `PUT /api/review-links/:id/reviewed` — Approve
- `PUT /api/review-links/:id/not-approved` — Reject
- `PUT /api/review-links/:id/comment` — Add comment

---

### 12. Complaints Management (`/dashboard/complaints-management`)

**Purpose:** View and manage customer complaints

**Layout (Admin):**
- List of all complaints
- Status filter (new, under_review, resolved)
- Review dialog with comments field

**Layout (Staff):**
- Submit new complaint form
- Status of submitted complaints

**Components Used:**
- `Dialog` — Submit complaint form
- `Form` — Complaint form
- File upload — Screenshot
- `Card` — Complaint display
- `Badge` — Status badges

**Data Fetched:**
- `GET /api/complaints` — All complaints (admin)
- `POST /api/complaints` — Submit complaint
- `PUT /api/complaints/:id` — Update status

---

### 13. Staff Complaints (`/dashboard/staff-complaints`)

**Purpose:** Internal complaints from staff about other staff

**Layout:**
- Submit complaint form
- Complaint list with status
- Admin review interface

**Components Used:**
- Form components
- Dialog — Form and details
- Badge — Status

**Data Fetched:**
- `POST /api/staff-complaints` — Submit
- `GET /api/staff-complaints` — List
- `PUT /api/staff-complaints/:id` — Review

---

### 14. Notes (`/dashboard/notes`)

**Purpose:** Personal note-taking and to-do lists

**Layout:**
- Create note button
- List of notes (cards or list view)
- Note categories/tags
- Search and filter
- Note detail view (edit/delete)

**Components Used:**
- `Dialog` — Create/edit note
- `Form` — Note form
- `Textarea` — Note content
- `Badge` — Category tags
- `Card` — Note display
- `Input` — Search field

**Note Types:**
- Regular notes
- To-do lists (with checkbox items)

**Data Fetched:**
- `GET /api/notes` — User's notes
- `POST /api/notes` — Create note
- `PUT /api/notes/:id` — Update note
- `DELETE /api/notes/:id` — Delete note

---

### 15. SOPs (`/dashboard/sop`)

**Purpose:** Browse and view Standard Operating Procedures

**Layout:**
- Department filter
- SOP list cards
- Detail modal with segments
- Search capability

**Components Used:**
- `Select` — Department filter
- `Card` — SOP cards
- `Dialog` — Detail view
- `Accordion` — SOP segments
- `Input` — Search

**Data Fetched:**
- `GET /api/sops` — All SOPs
- `GET /api/sops/departments` — Department list

---

### 16. Bookings (`/dashboard/bookings`)

**Purpose:** Schedule and manage meetings

**Layout:**
- Calendar view of bookings
- Create booking form
- Booking cards with participants
- Booking details modal

**Components Used:**
- `Calendar` — Calendar view
- `Dialog` — Create booking form
- `Form` — Booking form
- `Select` — Participant picker
- `Card` — Booking display

**Data Fetched:**
- `GET /api/bookings` — All bookings
- `GET /api/bookings/my-upcoming` — User's upcoming bookings
- `POST /api/bookings` — Create booking
- `PUT /api/bookings/:id` — Update booking

---

### 17. User Control (`/dashboard/user-control`)

**Purpose:** Admin panel for managing users (status, permissions, etc.)

**Layout:**
- User list table/cards
- Status indicator (online, offline, idle)
- User action buttons
- Search/filter

**Components Used:**
- `Table` or `Card` grid — User display
- Status indicator component
- Action dropdown menu
- Search input

**Data Fetched:**
- `GET /api/user-control/users` — All users
- `PATCH /api/user-control/:userId` — Update user

---

### 18. Profile (`/dashboard/profile`)

**Purpose:** View and edit user profile

**Layout:**
- User avatar and name
- Profile form fields (email, phone, etc.)
- Change password section
- Account settings

**Components Used:**
- `Form` — Profile form
- `Input` — Form fields
- `Avatar` — User picture
- `Button` — Save button

**Data Fetched:**
- `GET /api/user` — Current user
- `PUT /api/user` — Update profile

---

## Shared Sub-Components

### Task Components

**`TaskList`** (`/components/task/task-list.tsx`)
- Displays list of tasks for project managers
- Task cards with status badges
- Action buttons (start timer, submit, edit)
- Task progress indicators

**`StaffTaskList`** (`/components/task/staff-task-list.tsx`)
- Task view for staff members
- Timer interface (start/stop/pause)
- Task submission interface
- Time tracking display

### Project Components

**`ProjectCard`** (`/components/project/project-card.tsx`)
- Compact project display
- Status badge
- Progress bar
- Quick info (manager, dates)
- Click to navigate to details

**`ProjectForm`** (`/components/project/project-form.tsx`)
- Create/edit project form
- Client selection dropdown
- Team member selection
- Date pickers
- Form validation

### Chat Components

**`ChatWindow`** (`/components/chat/chat-window.tsx`)
- Reusable chat interface
- Message list with auto-scroll
- Message input form
- Message sender/timestamp
- Avatar display

**`DirectMessages`** (`/components/chat/direct-messages.tsx`)
- Conversation list
- Active conversation view
- Message rendering
- Input handling

---

## Shadcn/UI Components Used

The app uses extensive shadcn/ui component library components:

| Component | Usage |
|---|---|
| `Button` | All buttons (actions, navigation) |
| `Card` | Content cards, containers |
| `Dialog` | Modals and popups |
| `Input` | Text input fields |
| `Select` | Dropdown selections |
| `Tabs` | Tabbed content sections |
| `Badge` | Status badges, labels |
| `Avatar` | User profile pictures |
| `Accordion` | Collapsible sections |
| `Calendar` | Date picker |
| `Popover` | Popup containers |
| `Collapsible` | Expand/collapse sections |
| `Checkbox` | Checkbox inputs |
| `Table` | Data tables |
| `Form` | Form wrapper (with react-hook-form) |
| `Alert` | Alert messages |
| `AlertDialog` | Confirmation dialogs |
| `Breadcrumb` | Navigation breadcrumbs |
| `Command` | Command palette / search |
| `ContextMenu` | Right-click menus |
| `Dropdown` | Dropdown menus |
| `ScrollArea` | Scrollable containers |
| `Separator` | Visual dividers |
| `Toast` / `Toaster` | Notification toasts |
| `DropdownMenu` | Menu dropdowns |

---

## Icons

All icons from `lucide-react` library:
- Navigation: `ChevronDown`, `ChevronRight`, `Menu`, `X`
- Status: `CheckCircle`, `AlertCircle`, `Clock`, `HelpCircle`
- Actions: `Plus`, `Edit`, `Trash2`, `Send`, `Download`
- Categories: `FolderOpen`, `MessageSquare`, `Calendar`, `Users`
- And 50+ more

---

## Responsive Design

### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Responsive Features
- Sidebar collapses to mobile menu on small screens
- Grid layouts switch from multi-column to single column
- Header adapts (logo hidden, hamburger menu shown)
- Touch-friendly button sizes on mobile
- Popover dialogs on mobile, modals on desktop (sometimes)

### Tailwind Utility Classes Used
- `grid`, `flex` — Layout
- `responsive` — Mobile-first approach
- `gap`, `p`, `m` — Spacing
- `dark:` — Dark mode variants
- `transition`, `duration` — Animations

---

## Dark Mode Support

All components support light/dark mode:
- Theme toggle in header
- Stored in localStorage
- CSS custom properties for colors
- `dark:` prefix utilities throughout
- Theme context via `ThemeProvider`

---

## Performance Optimizations

### Query Caching
- `staleTime` — How long data is considered fresh
- `gcTime` — Garbage collection time for inactive queries
- `refetchInterval` — Automatic refetch intervals
- Some queries set to `staleTime: Infinity` to prevent refetches

### Component Optimization
- Lazy loading (e.g., OneSignalTest component)
- Suspense boundaries for loading states
- Memoization of expensive computations
- Optimistic updates for mutations

### Real-Time Updates
- WebSocket for task changes
- SSE for notifications
- Automatic query invalidation on mutations
- Window event dispatching for cross-tab communication

---

## Form Handling

All forms use **react-hook-form** with shadcn's `Form` wrapper:

```typescript
const form = useForm({ defaultValues: {...} });
const onSubmit = form.handleSubmit(async (data) => { ... });

// In JSX:
<Form {...form}>
  <form onSubmit={onSubmit}>
    <FormField
      control={form.control}
      name="fieldName"
      render={({ field }) => (
        <FormItem>
          <Input {...field} />
        </FormItem>
      )}
    />
  </form>
</Form>
```

**Validation:** Zod schemas integrated with react-hook-form

---

## Routing Structure

Using **wouter** (lightweight router):

```typescript
<Route path="/dashboard" component={Dashboard} />
<Route path="/dashboard/projects/:id" component={ProjectDetails} />
<Route path="/dashboard/projects/:id/tasks" component={ProjectTasks} />
// etc.
```

- Dynamic routes with parameters
- `useLocation()` hook for navigation
- `Redirect` component for conditional routing
- `PrivateRoute` wrapper for authenticated pages

---

## Total Component Count

- **Pages:** 47+ pages
- **UI Components:** 20+ shadcn/ui components
- **Custom Components:** 10+ (Header, Sidebar, TaskList, etc.)
- **Custom Hooks:** 12+ domain-specific hooks
- **Icons:** 60+ from lucide-react

**Code Location:**
- Pages: `client/src/pages/` and `client/src/pages/dashboard/`
- Components: `client/src/components/`
- Hooks: `client/src/hooks/`
- UI library: `client/src/components/ui/`

---

# Prompt H: User Roles & Access Control

## User Roles Overview

The system has **8 distinct user roles** with varying levels of access and permissions. Roles are stored in `users.role` (primary identifier) and can be further refined with `specialization`, `projectManagerType`, or `clientType`.

| Role | Count | Level | Primary Purpose |
|---|---|---|---|
| `operations_manager` | Typically 1-2 | **Admin** | System administration, full control |
| `team_lead` | Several | **Manager** | Team supervision, performance review |
| `project_manager` | Several | **Manager** | Project delivery, resource allocation |
| `customer_support_officer` | Several | **Specialist** | Client support, issue management |
| `staff` | Majority | **Worker** | Task execution, project work |
| `intern` | Several | **Worker** | Task execution, limited responsibility |
| `product_owner` | Several | **Specialist** | Product strategy, requirements |
| `client` | External | **External** | Client side access, limited view |

---

## Detailed Role Breakdown

### 1. Operations Manager (`operations_manager`)

**Access Level:** `ADMIN` — Full system access

**Identification:**
- `role = "operations_manager"` OR
- `specialization = "operations_manager"`

**Primary Responsibilities:**
- User account creation and management
- System-wide configuration
- Full access to all reports
- Send memos to all staff
- Review and manage all complaints
- Manage leave applications
- Issue formal staff queries
- Create and manage SOPs
- View all projects and tasks
- Access KPI reports
- Technical issue management

**Pages Accessible:**
1. Dashboard (Operations Manager version)
2. Projects (all projects)
3. Deadline Extension Requests
4. General Channel
5. Staff Report
6. KPI Report
7. Memos (send to all staff)
8. Bookings
9. Staff Queries / Penalty (issue and view)
10. Staff Complaints (review all)
11. Leave Management (review all)
12. Client Accounts
13. Client Sentiment Tracker
14. Client Complaints (review all)
15. Notes (personal)
16. SOPs (create/edit/delete)
17. Project Briefing (create/edit/delete)
18. Communication Tracker
19. Technical Management
20. Guide Videos
21. OneSignal Test (debug tool)
22. Report Management
23. Report Issues
24. Direct Messages
25. Profile
26. All Users

**Special Permissions:**
- Create new users
- Send memos (broadcast mode)
- Approve/reject leave requests
- Issue formal staff queries (warnings)
- Manage system SOPs and procedures
- Access admin-only features
- View all reports and analytics
- Technical support escalation

**Cannot Do:**
- Submit tasks (no task access)
- Submit leave requests (no time off)

---

### 2. Team Lead (`team_lead`)

**Access Level:** `MANAGER` — Team supervision and review

**Identification:**
- `role = "team_lead"`

**Primary Responsibilities:**
- Supervise staff performance
- Review and approve submitted work (review links)
- Manage team leave requests
- Monitor team productivity
- Approve deadline extensions
- Handle team complaints
- Send memos (to team members)

**Pages Accessible:**
1. Dashboard
2. Projects (assigned projects)
3. General Channel
4. Direct Messages
5. Staff Report
6. KPI Report
7. Client Accounts
8. Memos (send to team)
9. Assigned Reviews (review links) — **Key function**
10. Technical Management
11. Bookings
12. Leave Management (review requests)
13. Deadline Extension Requests (approve)
14. Staff Queries / Penalty (view received)
15. Client Complaints (review)
16. Staff Complaints (review)
17. Project Briefing
18. Guide Videos
19. Notes (personal)
20. Profile
21. All Users
22. Bookings

**Special Permissions:**
- Approve/reject review links
- Comment on submitted work
- Review and approve leave requests
- Review deadline extensions
- Send memos to staff
- View team performance data
- Review complaints (client and staff)
- Create users
- Create memos (send to team/all staff)
- Issue formal staff queries (warnings)
- Create and manage projects
- Assign tasks to team members

**Cannot Do:**
- Manage SOPs (admin-only feature)

---

### 3. Project Manager (`project_manager`)

**Access Level:** `MANAGER` — Project delivery and resource management

**Identification:**
- `role = "project_manager"`

**Sub-Types:**
- `projectManagerType = "main"` — Primary project authority
- `projectManagerType = "supervisor"` — Secondary/supervisory role

**Primary Responsibilities:**
- Create and manage projects
- Assign tasks to team members
- Monitor project progress
- Submit work for review
- Manage deadline extensions
- Monitor team productivity
- Track technical issues

**Pages Accessible:**
1. Dashboard
2. Projects (create, edit, delete own projects)
3. Tasks (view all, create new)
4. Team Chat (project-level messaging)
5. General Channel
6. Direct Messages
7. Staff Report
8. Client Accounts
9. Bookings
10. Leave Application (submit own)
11. Leave Management (review for own team)
12. Send for Review (submit work for review)
13. Technical Management
14. Deadline Extension Requests (approve for team)
15. Extension Requests (submit own)
16. Send Complaint (submit complaint)
17. Staff Queries / Penalty (view received)
18. Guide Videos
19. Notes (personal)
20. Profile
21. All Users
22. Bookings
23. Productivity Tracking
24. Project Briefing

**Special Permissions:**
- Create new projects
- Assign tasks to staff
- Delete own projects
- Edit project details
- Submit work for review (review links)
- Request deadline extensions for tasks
- View team productivity
- Manage project timelines

**Cannot Do:**
- Create users
- Send memos
- Approve review links (only team leads do)
- Issue staff queries
- Manage SOPs
- Access admin-only features

---

### 4. Staff (`staff`)

**Access Level:** `WORKER` — Task execution and daily work

**Identification:**
- `role = "staff"`

**Specializations (Optional):**
- `technical_support` — Handles technical issues
- `development` — Engineering/development
- `design` — Design work
- `automation` — Automation tasks
- `copywriting` — Content creation
- `media_buying` — Media/advertising
- `community_manager` — Community management
- etc.

**Primary Responsibilities:**
- Execute assigned tasks
- Track time spent on tasks
- Submit completed work
- Request time off (leave)
- Report issues and complaints
- Respond to memos
- Track productivity
- Request deadline extensions

**Pages Accessible:**
1. Dashboard
2. Projects (assigned projects only)
3. Tasks (assigned tasks)
4. Team Chat (project conversations)
5. General Channel
6. Direct Messages
7. Leave Application (submit own)
8. Productivity Tracking
9. Send Complaint (submit complaints)
10. Received Penalties (view staff queries)
11. Technical Support (submit issues) — **Unless specialization = technical_support**
12. Technical Management — **If specialization = technical_support**
13. Extension Requests (request deadline extension)
14. Memos (receive and respond)
15. Guide Videos
16. Notes (personal)
17. Profile
18. All Users

**Special Permissions:**
- Start/pause/stop task timers
- Submit completed tasks for review
- Request leave (time off)
- Submit technical issues
- Request deadline extensions
- Respond to memos (once per memo)
- Track personal productivity
- Submit complaints about work conditions

**Cannot Do:**
- Create projects
- Create users
- Assign tasks
- Approve work
- Send memos
- Access reports (KPI, staff reports)
- Manage bookings

---

### 5. Intern (`intern`)

**Access Level:** `WORKER (Limited)` — Supervised task execution

**Identification:**
- `role = "intern"`

**Specializations:**
Same as staff (optional)

**Primary Responsibilities:**
- Execute assigned tasks under supervision
- Track time on tasks
- Submit work for review
- Report issues
- Limited project participation

**Pages Accessible:**
1. Dashboard
2. Projects (assigned projects only)
3. Tasks (assigned tasks)
4. Team Chat
5. General Channel
6. Direct Messages
7. Leave Application (submit own)
8. Productivity Tracking
9. Send Complaint (submit)
10. Received Penalties
11. Technical Support (submit issues)
12. Extension Requests (request)
13. Memos (receive/respond)
14. Guide Videos
15. Notes (personal)
16. Profile
17. All Users

**Restrictions vs. Staff:**
- Same base access as staff
- Often assigned less critical tasks
- May have limited project visibility
- Subject to more supervision

**Cannot Do:**
- Create projects
- Create users
- Approve work
- Send memos
- Manage resources

---

### 6. Customer Support Officer (`customer_support_officer`)

**Access Level:** `SPECIALIST` — Client support and issue management

**Primary Responsibilities:**
- Manage client accounts and support
- Resolve technical issues
- Track client sentiment
- Handle client complaints
- Manage support contracts
- Respond to deadline extension requests

**Pages Accessible:**
1. Dashboard
2. Projects (view only)
3. General Channel
4. Direct Messages
5. Leave Application (submit own)
6. Client Management (manage client accounts)
7. Client Accounts
8. Client Complaints (review)
9. Technical Management (manage support requests)
10. Deadline Extension Requests (approve)
11. Extension Requests (submit own)
12. Bookings
13. Guide Videos
14. Notes (personal)
15. Profile
16. All Users
17. Project Briefing

**Special Permissions:**
- Manage client accounts
- View client sentiment data
- Resolve technical support requests
- Assign technical issues to staff
- Approve deadline extensions
- Review client complaints

**Cannot Do:**
- Create users
- Send memos
- Create projects
- Assign tasks
- Access admin reports

---

### 7. Product Owner (`product_owner`)

**Access Level:** `SPECIALIST` — Product strategy

**Identification:**
- `role = "product_owner"`

**Primary Responsibilities:**
- Define product requirements
- Manage product roadmap
- Strategic planning
- Work with teams on requirements

**Pages Accessible:**
1. Dashboard
2. Projects (view all)
3. General Channel
4. Direct Messages
5. Guide Videos
6. Notes (personal)
7. Profile
8. All Users

**Special Permissions:**
- View all projects (read-only)
- Access product documents
- Strategic collaboration

**Cannot Do:**
- Create/edit projects
- Assign tasks
- Access reports
- Send memos

---

### 8. Client (`client`)

**Access Level:** `EXTERNAL (Limited)` — Minimal access, project visibility only

**Identification:**
- `role = "client"`

**Sub-Types:**
- `clientType = "project_client"` — Project-based client
- `clientType = "support_maintenance_client"` — Ongoing support client

**Primary Responsibilities:**
- View assigned projects
- Provide feedback on work
- Submit satisfaction ratings
- Report issues with deliverables
- Emergency support requests (support_maintenance only)

**Pages Accessible (Project Client):**
1. Dashboard
2. Guide Videos
3. Client Sentiment (submit weekly feedback)
4. Register Dissatisfaction (complaint)
5. Rate Us
6. Reach Us (contact us)
7. Profile

**Pages Accessible (Support Maintenance Client) — Additional:**
1. Projects (can view assigned projects)
2. Team Chat (project communication)
3. General Channel (company-wide)
4. Direct Messages (with support team)
5. Support Policy
6. Emergency Support (off-hours help)

**Special Permissions:**
- Submit weekly sentiment feedback
- Rate service quality
- Register dissatisfaction (complaint)
- Contact support team
- View assigned projects (if support_maintenance)
- Emergency support access (if support_maintenance)

**Cannot Do:**
- Create anything
- Edit projects
- Assign tasks
- View internal reports
- Send messages (except with support team)
- Access staff data

---

## Role Access Matrix

### Project Access

| Role | Create | Edit | Delete | View | Assign Tasks |
|---|---|---|---|---|---|
| Operations Manager | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| Team Lead | ❌ | ❌ | ❌ | ✅ Team | ❌ |
| Project Manager | ✅ Own | ✅ Own | ✅ Own | ✅ All | ✅ Own |
| Staff | ❌ | ❌ | ❌ | ✅ Assigned | ❌ |
| Intern | ❌ | ❌ | ❌ | ✅ Assigned | ❌ |
| Support Officer | ❌ | ❌ | ❌ | ✅ View | ❌ |
| Product Owner | ❌ | ❌ | ❌ | ✅ All | ❌ |
| Client | ❌ | ❌ | ❌ | ✅ Assigned | ❌ |

### Task Management

| Role | Create | Edit | Submit | Review | Approve |
|---|---|---|---|---|---|
| Operations Manager | ✅ All | ✅ All | ❌ | ✅ All | ✅ All |
| Team Lead | ❌ | ❌ | ❌ | ✅ All | ✅ All |
| Project Manager | ✅ Own Projects | ✅ All | ❌ | ❌ | ❌ |
| Staff | ❌ | ❌ | ✅ Own | ❌ | ❌ |
| Intern | ❌ | ❌ | ✅ Own | ❌ | ❌ |
| Others | ❌ | ❌ | ❌ | ❌ | ❌ |

### Messaging & Memos

| Role | Send Memos | View Memos | Respond to Memos | Team Chat | Direct Messages |
|---|---|---|---|---|---|
| Operations Manager | ✅ All | ✅ Sent | N/A | ✅ | ✅ |
| Team Lead | ✅ Team | ✅ Received | ✅ | ✅ | ✅ |
| Project Manager | ❌ | ✅ Received | ✅ | ✅ | ✅ |
| Staff | ❌ | ✅ Received | ✅ | ✅ | ✅ |
| Intern | ❌ | ✅ Received | ✅ | ✅ | ✅ |
| Support Officer | ❌ | ✅ Received | ✅ | ❌ | ✅ |
| Product Owner | ❌ | ❌ | N/A | ❌ | ✅ |
| Client | ❌ | ❌ | N/A | ✅ (Project) | ✅ (Support) |

### Reporting & Analytics

| Role | KPI Report | Staff Report | Productivity | Client Sentiment | Technical Issues |
|---|---|---|---|---|---|
| Operations Manager | ✅ View/Export | ✅ View | ✅ View | ✅ Track/View | ✅ Manage |
| Team Lead | ✅ View | ✅ View | ✅ View | ❌ | ✅ Manage |
| Project Manager | ❌ | ❌ | ✅ Own Team | ❌ | ✅ View |
| Staff | ❌ | ❌ | ✅ Personal | ❌ | ✅ Submit |
| Intern | ❌ | ❌ | ✅ Personal | ❌ | ✅ Submit |
| Support Officer | ❌ | ❌ | ❌ | ✅ View | ✅ Manage |
| Product Owner | ❌ | ❌ | ❌ | ❌ | ❌ |
| Client | ❌ | ❌ | ❌ | ✅ Submit Weekly | ❌ |

### Admin Functions

| Role | Create Users | Manage Leave | Issue Queries | Manage SOPs | Manage Bookings |
|---|---|---|---|---|---|
| Operations Manager | ✅ | ✅ Review All | ✅ | ✅ | ✅ |
| Team Lead | ❌ | ✅ Review Team | ❌ | ❌ | ✅ |
| Project Manager | ❌ | ❌ | ❌ | ❌ | ✅ |
| Staff | ❌ | ✅ Submit | ❌ | ❌ | ❌ |
| Intern | ❌ | ✅ Submit | ❌ | ❌ | ❌ |
| Support Officer | ❌ | ❌ | ❌ | ❌ | ✅ |
| Others | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Special Features by Role

### Operations Manager / Team Lead (Shared)
- **Memo Broadcast** — Send messages to multiple staff
- **Leave Review** — Approve/reject staff leave requests
- **Query Issuance** — Issue formal warnings/queries
- **Complaint Review** — Review and respond to complaints
- **SOP Management** — Create/edit/delete Standard Operating Procedures
- **KPI Reports** — Access productivity and performance data
- **Full User List** — View all system users

### Project Manager Specific
- **Project Creation** — Create and manage projects
- **Task Assignment** — Assign work to team members
- **Review Submission** — Submit links for team lead review
- **Review Links** — "Send for Review" interface for work approval

### Team Lead Specific
- **Review Approval** — "Assigned Reviews" tab for approving work
- **Performance Review** — Access to staff performance reports
- **Team Supervision** — Focused on team (not all staff)

### Staff/Intern Specific
- **Task Timer** — Start/pause/stop timer for tracking time
- **Task Submission** — Submit completed work for review
- **Leave Request** — Request time off
- **Complaint Submission** — Submit work-related complaints
- **Productivity Tracking** — Personal productivity metrics
- **Penalty View** — View received formal warnings (staff queries)

### Client Specific
- **Weekly Sentiment** — Submit satisfaction rating every week
- **Dissatisfaction Report** — Register complaints about service
- **Service Rating** — Rate the service quality
- **Project Access** — Limited to assigned projects (if support_maintenance)
- **Emergency Support** — 24/7 support contact (if support_maintenance)

---

## Common Pages by Access Level

### All Authenticated Users Have Access To:
- Dashboard (personalized view)
- Guide Videos
- Profile
- All Users Directory
- Direct Messages (with permitted users)
- General Channel (read/write for most)

### Most Users (Except Clients) Have Access To:
- Projects
- Tasks (if assigned)
- Bookings
- Notes (personal)
- Memos (receive)
- Leave Application

### Leadership Only (Operations Manager, Team Lead, Project Manager):
- Staff Report
- KPI Report
- Client Accounts
- Bookings Management
- Deadline Extensions Review
- Technical Management

### Clients Only:
- Client Sentiment
- Register Dissatisfaction
- Rate Us
- Reach Us / Emergency Support

---

## Page Visibility Rules

```typescript
// Example role check patterns used in sidebar.tsx:

// Only for Operations Manager / Team Lead
if (user.role === "operations_manager" || user.specialization === "operations_manager" || user.role === "team_lead")

// For Project Managers and Team Leads
if (user.role === "project_manager" || user.role === "team_lead")

// For Staff and Interns
if (user.role === "staff" || user.role === "intern")

// For Support Officers
if (user.role === "customer_support_officer")

// For Clients with Special Access
if (user.role === "client" && user.clientType === "support_maintenance_client")

// For Technicians Only
if (user.specialization === "technical_support")
```

---

## Authentication & Authorization Flow

```
User Login
    ↓
[Validate credentials]
    ↓
[Retrieve user.role + specialization/type]
    ↓
[Session created with user object]
    ↓
[Frontend checks role for page access]
    ↓
[Backend also enforces role in API endpoints]
    ↓
[Sidebar builds menu based on role]
    ↓
[User sees only accessible pages]
```

---

## Summary: Total Users by Role

| Role | Access Level | Typical Count | Primary Activity |
|---|---|---|---|
| Operations Manager | Admin | 1-2 | System management, oversight |
| Team Lead | Manager | 2-5 | Team supervision, reviews |
| Project Manager | Manager | 3-8 | Project delivery |
| Customer Support Officer | Specialist | 2-4 | Client support |
| Staff | Worker | 15-50+ | Task execution, project work |
| Intern | Worker (Limited) | 5-10 | Training, task execution |
| Product Owner | Specialist | 1-3 | Product strategy |
| Client | External | 5-20+ | Project participation |

**Total System Users:** 30-100+ depending on organization size
