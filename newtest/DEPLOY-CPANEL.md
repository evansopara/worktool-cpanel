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
- [ ] OneSignal REST API key — regenerate in OneSignal → Settings → Keys & IDs

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
`xml`, `ctype`, `fileinfo`, `bcmath`, `curl`, `intl`.

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
| `ONESIGNAL_REST_API_KEY` | the new OneSignal key |

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

### 11. Update OneSignal
OneSignal dashboard → your app → Settings → Web configuration →
set the site URL to `https://workapp.wcdigitalagency.com`.
Push notifications are tied to the origin, so users must re-subscribe once.

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
