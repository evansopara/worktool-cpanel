# All App Notifications2

## In-App Notifications (Stored in Database + OneSignal Push)

| # | Notification Type | Trigger | Who Gets It |
|---|-------------------|---------|-------------|
| 1 | **Task Assigned** | New task created and assigned | The assigned staff member |
| 2 | **Task Updated** | Task submitted for review / status changed | Project Manager |
| 3 | **Task Updated** | Task reassigned to different user | New assignee |
| 4 | **Task Completed** | Review link approved by team lead | Project Manager who submitted it |
| 5 | **Deadline Reminder** | Task due in <24 hours | Task assignee |
| 6 | **Deadline Missed** | Task deadline passed | Assignee + Project Managers + Operations Managers |
| 7 | **Memo Received** | New memo sent (general/individual/department) | All targeted recipients |
| 8 | **Staff Query** | Formal warning/query issued to staff | The staff member + Operations Managers |
| 9 | **Leave Application** | Staff submits leave request | Project Managers + Operations Managers |
| 10 | **Leave Approved/Rejected** | Leave request reviewed | The applicant |
| 11 | **Technical Support Request** | New support ticket created | All `technical_support` staff |
| 12 | **Issue Report** | New bug/feature report submitted | Operations Managers + Product Owners |
| 13 | **Issue Report Updated** | Report status changed (resolved/closed) | The original reporter |
| 14 | **Client Complaint** | New client complaint submitted | Operations Managers |
| 15 | **Complaint Reviewed** | Complaint status updated | The submitter |
| 16 | **Deadline Extension Request** | Staff requests more time | Project Manager |
| 17 | **Extension Approved/Declined** | Request reviewed | The requester |
| 18 | **Review Link Comment** | Team lead/PM adds comment | The other party |
| 19 | **Team Mention** | User @mentioned in team chat | The mentioned user |
| 20 | **Break Overtime** | Break exceeds 75-90 min limit | The staff member |
| 21 | **Break Ended** | Break auto-ended after 60 min | The staff member |
| 22 | **Break Reminder** | Daily break time reached | The staff member |

## Email Notifications Only (No In-App Storage)

| # | Type | Trigger |
|---|------|---------|
| 23 | **Direct Message** | New DM received |
| 24 | **DM Reply** | Someone replies to your message |
| 25 | **General Channel Message** | New message in general channel |

## Real-Time Push (WebSocket / SSE / OneSignal)

| # | Event | Channel |
|---|-------|---------|
| 26 | **New Task Created** | WebSocket broadcast |
| 27 | **Task Updated** | WebSocket broadcast |
| 28 | **Project Updated** | WebSocket broadcast |
| 29 | **Review Link Assigned** | SSE to team lead |
| 30 | **Review Link Reviewed** | SSE to project manager |
| 31 | **Direct Message** | OneSignal push + SSE |
| 32 | **Team Chat Message** | OneSignal push to all project members + SSE |

---

**Total: 32 distinct notification events** across the entire app.
