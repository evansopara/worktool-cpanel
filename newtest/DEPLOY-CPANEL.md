# Workapp — cPanel deployment guide

Target: **https://workapp.wcdigitalagency.com**
Stack: Laravel 11.51 API + Next.js static front end (served from `public/`)

## What is in this package

| Path | Contents |
|---|---|
| `workapp/` | The application, configured for cPanel |
| `database/workapp.sql.gz` | Cleaned database, schema synced to the code |
| `DEPLOY-CPANEL.md` | This guide |

## Before you start: rotate these secrets

The old server exposed them through a publicly downloadable `backup-new.zip`.
Create **new** values; do not reuse the old ones.

- [ ] Database password (you will create a new one in step 3)
- [ ] Gmail App Password for `evanney2018@gmail.com` — revoke the old one at
      myaccount.google.com → Security → App passwords, then create a new one

`APP_KEY` has already been replaced with a fresh key.

## Deployment

### 1. Create the domain
cPanel → **Domains** → Create A New Domain → `workapp.wcdigitalagency.com`

- Untick **Share document root**
- Set **Document Root** to `workapp/public`

Pointing the document root at `public/` keeps the application code, `.env`
and `storage/` outside the web root. (A safety-net `.htaccess` also protects
them if the root ends up at `workapp/`, but `public/` is the correct setup.)

### 2. Set PHP version
cPanel → **MultiPHP Manager** → select the domain → **PHP 8.3** (8.2 minimum).

If your host has **Select PHP Version** (CloudLinux), make sure these
extensions are enabled: `pdo_mysql`, `mbstring`, `openssl`, `tokenizer`,
`xml`, `ctype`, `fileinfo`, `bcmath`, `curl`, `intl`, and `gmp`
(recommended: it makes sending push notifications much faster).

### 3. Create the database
cPanel → **MySQL Databases**

1. Create database `workapp` → cPanel names it `CPANELUSER_workapp`
2. Create a user with a strong new password
3. Add the user to the database with **ALL PRIVILEGES**

### 4. Import the database
cPanel → **phpMyAdmin** → select `CPANELUSER_workapp` → **Import** →
choose `database/workapp.sql.gz` → Go.

The dump contains no `CREATE DATABASE`/`USE` lines, so it imports into
whatever name cPanel gave you. Expect 48 tables.

### 5. Upload the application
cPanel → **File Manager** → your home directory (`/home/CPANELUSER`) →
**Upload** the archive → right-click → **Extract**.
You should end up with `/home/CPANELUSER/workapp/`.

> **Do this as your cPanel user, not via WHM/root.** cPanel serves symlinks
> only when the link and its target have the same owner
> (`SymLinksIfOwnerMatch`). Files extracted as root break `/storage/...`
> URLs with a 403.

### 6. Fill in `.env`
Edit `workapp/.env` and replace every `CHANGE_ME`:

| Key | Value |
|---|---|
| `DB_DATABASE` | `CPANELUSER_workapp` |
| `DB_USERNAME` | the user from step 3 |
| `DB_PASSWORD` | the new password from step 3 |
| `MAIL_PASSWORD` | the new Gmail App Password |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | the Web Push keys (see step 11) |

Leave `APP_DEBUG=false`. Keep `.env` permissions at **640**.

### 7. Check the storage link
`workapp/public/storage` must be a symlink to `../storage/app/public`.
Some File Manager versions drop symlinks when extracting. If it is missing,
open cPanel → **Terminal** and run:

```bash
cd ~/workapp && ln -s ../storage/app/public public/storage
```

### 8. Add the scheduler cron job
cPanel → **Cron Jobs** → Common Settings: **Once Per Minute** → Command:

```bash
/usr/local/bin/php /home/CPANELUSER/workapp/artisan schedule:run >/dev/null 2>&1
```

If that PHP path is not 8.3 on your server, use
`/opt/cpanel/ea-php83/root/usr/bin/php` instead.

This drives three jobs: task-deadline checks and booking notifications
(every minute) and domain-expiry checks (daily 08:00).

### 9. Enable HTTPS
cPanel → **SSL/TLS Status** → run **AutoSSL** for the domain.
The `.htaccess` already redirects HTTP → HTTPS and allows the
`/.well-known/` validation path AutoSSL needs.

### 10. Optimise (recommended)
cPanel → **Terminal**:

```bash
cd ~/workapp && php artisan optimize
```

Tested: config, route, view and event caches all work with this app.
Run `php artisan optimize:clear` after any future `.env` change.

### 11. Web Push notifications
Push notifications are self-hosted (no OneSignal account). The service
worker is `public/sw.js`; subscriptions live in the `push_subscriptions`
table, created by `php artisan migrate --force`.

- Copy `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` from the
  developer's `.env`, or generate a pair once with
  `php -r "require 'vendor/autoload.php'; print_r(Minishlink\WebPush\VAPID::createVapidKeys());"`.
  **Never change them afterwards**: new keys silently break every device's
  subscription until each user re-enables alerts.
- Each user taps **Enable alerts** in the header once per device.
  On iPhone/iPad (iOS 16.4+) they must first *Add to Home Screen* and open
  Worktool from that icon.
- Test with `php artisan push:test <userId>`.

### 12. Task deadline reminders
The scheduler cron (step 8) also reminds a task's assignee when the task is
halfway between its start and its deadline, and again 10 minutes before the
deadline (push and in-app only, no email). It needs two new columns on
`tasks`. With a terminal, `php artisan migrate --force` adds them. Without
one, run this in **phpMyAdmin → SQL**. It also marks reminders whose time has
already passed as sent, so deploying doesn't trigger a burst of old reminders:

```sql
SET time_zone = '+01:00'; -- Africa/Lagos, the app timezone

ALTER TABLE `tasks`
  ADD COLUMN `halfway_notified_at` timestamp NULL DEFAULT NULL,
  ADD COLUMN `deadline_warning_notified_at` timestamp NULL DEFAULT NULL;

UPDATE `tasks` SET `halfway_notified_at` = NOW()
WHERE `deadline` IS NOT NULL
  AND `status` NOT IN ('review', 'completed', 'not_approved', 'deadline_missed')
  AND TIMESTAMPADD(SECOND,
        GREATEST(0, TIMESTAMPDIFF(SECOND, COALESCE(`start_date`, `created_at`, `deadline`), `deadline`)) DIV 2,
        COALESCE(`start_date`, `created_at`, `deadline`)) <= NOW();

UPDATE `tasks`
SET `halfway_notified_at` = COALESCE(`halfway_notified_at`, NOW()),
    `deadline_warning_notified_at` = NOW()
WHERE `deadline` IS NOT NULL
  AND `status` NOT IN ('review', 'completed', 'not_approved', 'deadline_missed')
  AND `deadline` <= NOW() + INTERVAL 10 MINUTE;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_10_20_000001_add_deadline_reminder_flags_to_tasks_table', COALESCE(MAX(`batch`), 0) + 1
FROM `migrations`
WHERE NOT EXISTS (SELECT 1 FROM `migrations`
  WHERE `migration` = '2026_10_20_000001_add_deadline_reminder_flags_to_tasks_table');
```

Until the columns exist, tasks keep working and missed deadlines are still
flagged; only the new reminders are skipped.

### 13. Task history and task rules (redesign)

The redesigned task screens record every task action in a history table and
enforce the new task rules. **Add the database changes before uploading the
code**: the new code needs them, while the old code ignores them, so this order
never breaks the live site. Deploy this backend together with the new task
screens (redesign step 4); the old screens can't show the new "start early" and
"read the instructions" prompts.

With a terminal: `php artisan migrate --force`. Without one, run this in
**phpMyAdmin → SQL**:

```sql
SET time_zone = '+01:00'; -- Africa/Lagos, the app timezone

ALTER TABLE `tasks`
  ADD COLUMN `original_deadline` datetime NULL DEFAULT NULL,
  ADD COLUMN `original_estimate_minutes` int NULL DEFAULT NULL,
  ADD COLUMN `instructions_updated_at` timestamp NULL DEFAULT NULL,
  ADD COLUMN `lock_early_start` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `estimate_warned_at` timestamp NULL DEFAULT NULL,
  ADD COLUMN `estimate_reached_at` timestamp NULL DEFAULT NULL,
  ADD COLUMN `deleted_at` timestamp NULL DEFAULT NULL;

ALTER TABLE `task_sessions`
  ADD COLUMN `started_early` tinyint(1) NOT NULL DEFAULT 0,
  ADD COLUMN `clash_task_id` bigint unsigned NULL DEFAULT NULL;

CREATE TABLE `task_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `task_id` bigint unsigned NOT NULL,
  `actor_id` bigint unsigned NULL DEFAULT NULL,
  `type` varchar(40) NOT NULL,
  `from` json NULL,
  `to` json NULL,
  `meta` json NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `task_events_task_id_created_at_index` (`task_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `task_reads` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `task_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `read_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `instructions_version` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `task_reads_task_id_user_id_unique` (`task_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `estimate_requests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `task_id` bigint unsigned NOT NULL,
  `requester_id` bigint unsigned NOT NULL,
  `requested_minutes` int NOT NULL,
  `reason` text NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `approved_minutes` int NULL DEFAULT NULL,
  `decision_reason` text NULL,
  `decided_by` bigint unsigned NULL DEFAULT NULL,
  `decided_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `estimate_requests_task_id_index` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Today's deadline and estimate become the originals KPIs compare against.
UPDATE `tasks` SET `original_deadline` = `deadline` WHERE `deadline` IS NOT NULL;
UPDATE `tasks`
SET `original_estimate_minutes` = COALESCE(`working_hours`, 0) * 60 + COALESCE(`working_minutes`, 0)
WHERE `working_hours` IS NOT NULL OR `working_minutes` IS NOT NULL;

-- Estimate alerts that are already due count as sent, so the first cron run
-- doesn't send a burst of old alerts.
UPDATE `tasks`
SET `estimate_warned_at` = NOW()
WHERE `status` <> 'completed'
  AND (COALESCE(`working_hours`, 0) * 60 + COALESCE(`working_minutes`, 0)) > 0
  AND `time_spent` + IF(`is_timer_running` = 1 AND `timer_start_time` IS NOT NULL, TIMESTAMPDIFF(SECOND, `timer_start_time`, NOW()), 0)
      >= (COALESCE(`working_hours`, 0) * 60 + COALESCE(`working_minutes`, 0)) * 60 * 0.8;
UPDATE `tasks`
SET `estimate_reached_at` = NOW()
WHERE `status` <> 'completed'
  AND (COALESCE(`working_hours`, 0) * 60 + COALESCE(`working_minutes`, 0)) > 0
  AND `time_spent` + IF(`is_timer_running` = 1 AND `timer_start_time` IS NOT NULL, TIMESTAMPDIFF(SECOND, `timer_start_time`, NOW()), 0)
      >= (COALESCE(`working_hours`, 0) * 60 + COALESCE(`working_minutes`, 0)) * 60;

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_10_27_000001_add_task_history_and_rules', COALESCE(MAX(`batch`), 0) + 1
FROM `migrations`
WHERE NOT EXISTS (SELECT 1 FROM `migrations`
  WHERE `migration` = '2026_10_27_000001_add_task_history_and_rules');
```

Task history starts from the moment this is deployed; actions taken before
then aren't in it. Deleted tasks are now kept (hidden) so their history stays.

## Verify

| Check | Expected |
|---|---|
| `https://workapp.wcdigitalagency.com/` | the app loads |
| `https://workapp.wcdigitalagency.com/up` | 200 |
| `https://workapp.wcdigitalagency.com/api/auth/me` | 401 (JSON) |
| `https://workapp.wcdigitalagency.com/.env` | 403 |
| `http://workapp.wcdigitalagency.com/` | redirects to https |
| Log in | works; everyone must sign in again (old sessions were revoked) |

## ⚠️ Do not run `php artisan migrate` expecting it to build the schema

This database was originally created by SQL import, not by migrations.
The package's database has been synced so `php artisan migrate` is now a
harmless no-op ("Nothing to migrate") — but:

- **Never run `migrate:fresh`, `migrate:reset`, or `db:wipe`** — they delete
  all data.
- **Never force-run `2024_01_01_000001_create_users_table`** — it begins with
  `drop table if exists users`.

Future migrations the developer adds will run normally with
`php artisan migrate --force`.

## After go-live

- **User 29 (`Akinstemi`)** must use **Forgot password** — their old password
  was exposed and has been disabled.
- **All users** sign in again; old API sessions were revoked.
- On the **first cron run**, 2 genuinely overdue tasks will be marked
  `deadline_missed` and their owners notified. Past bookings will *not*
  trigger notifications (they have been pre-flagged).
- **Delete the old Cloudways app** — it still hosts the exposed
  `backup-new.zip` and the old secrets.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| 500 error on every page | Group-writable files. Directories must be 755, files 644. |
| 403 on `/storage/...` images | Symlink owned by a different user — recreate it (step 7) as your cPanel user |
| 404 on `/dashboard` etc. | Document root is not `workapp/public`, or `.htaccess` was not uploaded |
| "SQLSTATE[HY000] [1045] Access denied" | `.env` database values; user not added to the database with privileges |
| Password e-mails not arriving | `MAIL_PASSWORD` must be a Gmail **App Password**, not the account password |
| Old settings still in effect | `php artisan optimize:clear` |

## What changed from the Cloudways build

Security
- Password-setup tokens are stored as **SHA-256 hashes** with expiry
  (forgot-password 60 min, invitations 7 days, admin resets 72 h). A leaked
  database can no longer be used to take over accounts.
- Trust-all-proxies removed (it allowed IP / host spoofing without a load balancer).
- `.htaccess` refuses archives, SQL dumps, backups, logs and env files, and
  sends security headers (HSTS, nosniff, frame options, referrer policy).
- Fresh `APP_KEY`; `APP_DEBUG=false`; `APP_ENV=production`.

Hosting
- HTTPS detection uses cPanel's `%{HTTPS}` instead of Cloudways load-balancer headers.
- `public/storage` is a relative symlink (the old one hard-coded a Cloudways path).
- URLs, CORS and cookies set for `workapp.wcdigitalagency.com`.
- Corrected Laravel 11 env names (`CACHE_STORE`, bare-host `SANCTUM_STATEFUL_DOMAINS`).
- Old sessions, compiled views and logs from the previous server removed.

Database
- Applied the 6 migrations that had never run and finished 2 half-applied ones —
  this fixes the booking and domain-expiry cron jobs that were failing every
  minute on the old server.
- Recorded 22 migrations whose changes were already present.
- Past bookings pre-flagged so go-live does not send stale notifications.
