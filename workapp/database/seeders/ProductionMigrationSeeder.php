<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Migrates production data from the PostgreSQL dump (DATABASE_DUMP_PROD.sql)
 * into the current MySQL database schema.
 *
 * Run with: php artisan db:seed --class=ProductionMigrationSeeder
 *
 * Prerequisites:
 *  1. Switch DB_CONNECTION=mysql in .env and configure DB credentials.
 *  2. Run: php artisan migrate
 *     (this creates the schema including the legacy user columns migration)
 *  3. Then run this seeder.
 *
 * Limitations:
 *  - The dump only contains the first 100 of 1,070 tasks.
 *  - Direct messages, project messages, notifications, memo reads/responses,
 *    and task sessions are NOT in the dump and will not be migrated.
 */
class ProductionMigrationSeeder extends Seeder
{
    private array $lines = [];

    public function run(): void
    {
        $dumpPath = base_path('../DATABASE_DUMP_PROD.sql');

        if (!file_exists($dumpPath)) {
            $this->command->error("Dump file not found at: {$dumpPath}");
            $this->command->error("Expected path relative to backend/: ../DATABASE_DUMP_PROD.sql");
            return;
        }

        $content     = file_get_contents($dumpPath);
        $this->lines = explode("\n", str_replace("\r\n", "\n", $content));

        $this->command->info('Starting production data migration...');

        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        try {
            $this->migrateUsers();
            $this->migrateProjects();
            $this->migrateTasks();
            $this->migrateProjectMembers();
            $this->migrateMemos();
            $this->migrateBookings();
            $this->migrateLeaveApplications();
            $this->migrateTechnicalSupportRequests();
            $this->migrateIssueReports();
            $this->migrateComplaints();
            $this->migrateStaffComplaints();
            $this->migrateStaffQueries();
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }

        $this->command->newLine();
        $this->command->info('✓ Production data migration complete!');
        $this->command->newLine();
        $this->command->warn('NOT migrated (not in dump):');
        $this->command->warn('  - Direct messages (1,913 rows)');
        $this->command->warn('  - Project messages (1,755 rows)');
        $this->command->warn('  - Message read receipts (160,103 rows)');
        $this->command->warn('  - Notifications (96,134 rows)');
        $this->command->warn('  - Task sessions');
        $this->command->warn('  - Memo reads & responses');
        $this->command->warn('  - Tasks 101–1,070 (dump only includes first 100)');
    }

    // =========================================================================
    // TABLE MIGRATIONS
    // =========================================================================

    private function migrateUsers(): void
    {
        $records = $this->parseTable('=== TABLE: USERS');
        $this->command->info("Importing " . count($records) . " users...");

        foreach ($records as $rec) {
            // Split "Emmanuel Evans" → first_name="Emmanuel", last_name="Evans"
            $nameParts = explode(' ', trim($rec['name'] ?? ''), 2);
            $firstName = $nameParts[0] ?: ($rec['username'] ?? 'Unknown');
            $lastName  = $nameParts[1] ?? null;

            // Map old work_status values to new schema values
            $workStatus = match ($rec['work_status'] ?? 'active') {
                'on_break' => 'busy',
                default    => 'available',
            };

            // Map is_active (t/f) to account status (active/inactive)
            $accountStatus = ($rec['is_active'] ?? 't') === 't' ? 'active' : 'inactive';

            DB::table('users')->insertOrIgnore([
                'id'                     => (int) $rec['id'],
                'first_name'             => $firstName,
                'last_name'              => $lastName ?? '',
                'email'                  => $rec['email'],
                'password'               => $rec['password'],
                'role'                   => $rec['role'],
                'specialization'         => $rec['specialization'],
                'status'                 => $accountStatus,
                'work_status'            => $workStatus,
                'must_set_password'      => ($rec['must_set_password'] ?? 'f') === 't' ? 1 : 0,
                'password_setup_token'   => $rec['password_setup_token'],
                'current_task_id'        => null, // avoid FK issues; transient field
                'last_active'            => $rec['last_active'],
                'email_verified_at'      => ($rec['email_verified'] ?? 'f') === 't'
                    ? ($rec['created_at'] ?? now())
                    : null,
                'created_at'             => $rec['created_at'] ?? now(),
                'updated_at'             => $rec['created_at'] ?? now(),
                // Legacy columns (added by 2026_04_01_200000 migration)
                'username'               => $rec['username'],
                'is_active'              => ($rec['is_active'] ?? 't') === 't' ? 1 : 0,
                'last_seen'              => $rec['last_seen'],
                'break_count'            => (int) ($rec['break_count'] ?? 0),
                'break_start_time'       => $rec['break_start_time'],
                'break_one_time'         => $rec['break_one_time'],
                'task_start_time'        => $rec['task_start_time'],
                'absence_reason'         => $rec['absence_reason'],
                'absence_end_date'       => $rec['absence_end_date'],
                'onboarding_status'      => $rec['onboarding_status'],
                'product_service'        => $rec['product_service'],
                'client_type'            => $rec['client_type'],
                'gender'                 => $rec['gender'],
                'project_manager_type'   => $rec['project_manager_type'],
                'verification_token'     => $rec['verification_token'],
                'reset_password_token'   => $rec['reset_password_token'],
                'reset_password_expires' => $rec['reset_password_expires'],
            ]);
        }

        $this->resetAutoIncrement('users', $records);
        $this->command->info("  ✓ " . count($records) . " users imported.");
    }

    private function migrateProjects(): void
    {
        $records = $this->parseTable('=== TABLE: PROJECTS');
        $this->command->info("Importing " . count($records) . " projects...");

        $statusMap = [
            'pending'   => 'active',
            'active'    => 'active',
            'completed' => 'inactive',
            'on_hold'   => 'inactive',
            'cancelled' => 'inactive',
            'inactive'  => 'inactive',
        ];

        foreach ($records as $rec) {
            DB::table('projects')->insertOrIgnore([
                'id'          => (int) $rec['id'],
                'name'        => $rec['name'],
                'description' => $rec['description'],
                'type'        => $rec['type'],
                'status'      => $statusMap[$rec['status'] ?? 'pending'] ?? 'active',
                'progress'    => (int) ($rec['progress'] ?? 0),
                'client_id'   => $rec['client_id'] ? (int) $rec['client_id'] : null,
                'manager_id'  => $rec['manager_id'] ? (int) $rec['manager_id'] : null,
                'start_date'  => $rec['start_date']
                    ? date('Y-m-d', strtotime($rec['start_date']))
                    : null,
                'end_date'    => $rec['end_date']
                    ? date('Y-m-d', strtotime($rec['end_date']))
                    : null,
                'budget'      => null,
                'created_at'  => $rec['created_at'] ?? now(),
                'updated_at'  => $rec['updated_at'] ?? now(),
            ]);
        }

        $this->resetAutoIncrement('projects', $records);
        $this->command->info("  ✓ " . count($records) . " projects imported.");
    }

    private function migrateTasks(): void
    {
        $records = $this->parseTable('=== TABLE: TASKS');
        $this->command->info("Importing " . count($records) . " tasks (dump contains first 100 of 1,070)...");

        foreach ($records as $rec) {
            // Apply the same status/priority normalization as the update migration
            $status   = $rec['status'] ?? 'todo';
            if ($status === 'pending') $status = 'todo';

            $priority = $rec['priority'] ?? 'medium';
            if ($priority === 'urgent') $priority = 'high';

            DB::table('tasks')->insertOrIgnore([
                'id'                => (int) $rec['id'],
                'title'             => $rec['title'],
                'description'       => $rec['description'],
                'project_id'        => (int) $rec['project_id'],
                'assignee_id'       => $rec['assignee_id'] ? (int) $rec['assignee_id'] : null,
                'assigned_by'       => $rec['assigned_by'] ? (int) $rec['assigned_by'] : null,
                'status'            => $status,
                'priority'          => $priority,
                'progress'          => (int) ($rec['progress'] ?? 0),
                'iteration_number'  => (int) ($rec['iteration_number'] ?? 1),
                'start_date'        => $rec['start_date'],
                'deadline'          => $rec['deadline'],
                'working_hours'     => $rec['working_hours'] !== null ? (int) $rec['working_hours'] : null,
                'working_minutes'   => $rec['working_minutes'] !== null ? (int) $rec['working_minutes'] : null,
                'actual_start_time' => $rec['actual_start_time'],
                'review_started_at' => $rec['review_started_at'],
                'completed_at'      => $rec['completed_at'],
                'time_spent'        => (int) ($rec['time_spent'] ?? 0),
                'is_timer_running'  => ($rec['is_timer_running'] ?? 'f') === 't' ? 1 : 0,
                'timer_start_time'  => $rec['timer_start_time'],
                'has_been_started'  => ($rec['has_been_started'] ?? 'f') === 't' ? 1 : 0,
                'created_at'        => $rec['created_at'] ?? now(),
                'updated_at'        => $rec['updated_at'] ?? now(),
            ]);
        }

        $this->resetAutoIncrement('tasks', $records);
        $this->command->info("  ✓ " . count($records) . " tasks imported.");
    }

    private function migrateProjectMembers(): void
    {
        $records = $this->parseTable('=== TABLE: PROJECT MEMBERS');
        $this->command->info("Importing " . count($records) . " project member records...");

        $inserted = 0;
        $skipped  = 0;

        // Track inserted (project_id, user_id) pairs to handle duplicates in dump
        $seen = [];

        foreach ($records as $rec) {
            $projectId = (int) $rec['project_id'];
            $userId    = (int) $rec['user_id'];
            $key       = "{$projectId}:{$userId}";

            if (isset($seen[$key])) {
                $skipped++;
                continue;
            }
            $seen[$key] = true;

            DB::table('project_members')->insertOrIgnore([
                'id'                => (int) $rec['id'],
                'project_id'        => $projectId,
                'user_id'           => $userId,
                'role'              => $rec['role'],
                'invitation_status' => $rec['invitation_status'] ?? 'accepted',
            ]);
            $inserted++;
        }

        $this->resetAutoIncrement('project_members', $records);
        $this->command->info("  ✓ {$inserted} project members imported, {$skipped} duplicates skipped.");
    }

    private function migrateMemos(): void
    {
        // Old schema: id, title, content, type, recipients, sent_by, created_at, updated_at
        // New schema: id, subject, content, recipients, sender_id, created_at, updated_at
        $records = $this->parseTable('=== TABLE: MEMOS');
        $this->command->info("Importing " . count($records) . " memos...");

        foreach ($records as $rec) {
            DB::table('memos')->insertOrIgnore([
                'id'         => (int) $rec['id'],
                'subject'    => $rec['title'] ?? $rec['subject'] ?? '',
                'content'    => $rec['content'] ?? '',
                'recipients' => $this->cleanJson($rec['recipients'] ?? null),
                'sender_id'  => (int) ($rec['sent_by'] ?? $rec['sender_id'] ?? 1),
                'created_at' => $rec['created_at'] ?? now(),
                'updated_at' => $rec['updated_at'] ?? now(),
            ]);
        }

        $this->resetAutoIncrement('memos', $records);
        $this->command->info("  ✓ " . count($records) . " memos imported.");
    }

    private function migrateBookings(): void
    {
        // Old and new schemas match; new has extra 'location' column (set null)
        $records = $this->parseTable('=== TABLE: BOOKINGS');
        $this->command->info("Importing " . count($records) . " bookings...");

        foreach ($records as $rec) {
            DB::table('bookings')->insertOrIgnore([
                'id'           => (int) $rec['id'],
                'title'        => $rec['title'],
                'description'  => $rec['description'],
                'type'         => $rec['type'],
                'scheduled_by' => (int) $rec['scheduled_by'],
                'participants' => $this->cleanJson($rec['participants'] ?? null),
                'start_time'   => $rec['start_time'],
                'end_time'     => $rec['end_time'],
                'status'       => $rec['status'] ?? 'scheduled',
                'location'     => null,
                'meeting_link' => $rec['meeting_link'],
                'notes'        => $rec['notes'],
                'created_at'   => $rec['created_at'] ?? now(),
                'updated_at'   => $rec['updated_at'] ?? now(),
            ]);
        }

        $this->resetAutoIncrement('bookings', $records);
        $this->command->info("  ✓ " . count($records) . " bookings imported.");
    }

    private function migrateLeaveApplications(): void
    {
        // Old: review_comments → New: review_comment (singular)
        // Old has extra 'total_days' column (dropped)
        $records = $this->parseTable('=== TABLE: LEAVE APPLICATIONS');
        $this->command->info("Importing " . count($records) . " leave applications...");

        foreach ($records as $rec) {
            DB::table('leave_applications')->insertOrIgnore([
                'id'              => (int) $rec['id'],
                'user_id'         => (int) $rec['user_id'],
                'leave_type'      => $rec['leave_type'] ?? 'day_off',
                'reason'          => $rec['reason'],
                'start_date'      => $rec['start_date']
                    ? date('Y-m-d', strtotime($rec['start_date']))
                    : null,
                'end_date'        => $rec['end_date']
                    ? date('Y-m-d', strtotime($rec['end_date']))
                    : null,
                'proof_image_url' => $rec['proof_image_url'],
                'status'          => $rec['status'] ?? 'pending',
                'applied_at'      => $rec['applied_at'] ?? $rec['created_at'] ?? now(),
                'reviewed_at'     => $rec['reviewed_at'],
                'reviewed_by'     => $rec['reviewed_by'] ? (int) $rec['reviewed_by'] : null,
                'review_comment'  => $rec['review_comments'] ?? $rec['review_comment'] ?? null,
                'created_at'      => $rec['created_at'] ?? now(),
                'updated_at'      => $rec['updated_at'] ?? now(),
            ]);
        }

        $this->resetAutoIncrement('leave_applications', $records);
        $this->command->info("  ✓ " . count($records) . " leave applications imported.");
    }

    private function migrateTechnicalSupportRequests(): void
    {
        $records = $this->parseTable('=== TABLE: TECHNICAL SUPPORT REQUESTS');
        $this->command->info("Importing " . count($records) . " technical support requests...");

        foreach ($records as $rec) {
            DB::table('technical_support_requests')->insertOrIgnore([
                'id'             => (int) $rec['id'],
                'title'          => $rec['title'],
                'description'    => $rec['description'],
                'task_id'        => $rec['task_id'] ? (int) $rec['task_id'] : null,
                'requester_id'   => (int) $rec['requester_id'],
                'assigned_to_id' => $rec['assigned_to_id'] ? (int) $rec['assigned_to_id'] : null,
                'status'         => $rec['status'] ?? 'open',
                'priority'       => $rec['priority'] ?? 'medium',
                'resolution'     => $rec['resolution'],
                'resolved_at'    => $rec['resolved_at'],
                'created_at'     => $rec['created_at'] ?? now(),
                'updated_at'     => $rec['updated_at'] ?? now(),
            ]);
        }

        $this->resetAutoIncrement('technical_support_requests', $records);
        $this->command->info("  ✓ " . count($records) . " technical support requests imported.");
    }

    private function migrateIssueReports(): void
    {
        // Old schema has: reporter_name, reporter_email, suggestions, category, submitter_id, review_comments
        // New schema has: reported_by (FK), project_id, task_id, resolution, resolved_at, reviewed_by, reviewed_at
        // Mapping: submitter_id → reported_by, review_comments → resolution
        $records = $this->parseTable('=== TABLE: ISSUE REPORTS');
        $this->command->info("Importing " . count($records) . " issue reports...");

        foreach ($records as $rec) {
            DB::table('issue_reports')->insertOrIgnore([
                'id'             => (int) $rec['id'],
                'title'          => $rec['title'],
                'description'    => $rec['description'],
                'reported_by'    => $rec['submitter_id'] ? (int) $rec['submitter_id'] : null,
                'project_id'     => null,
                'task_id'        => null,
                'priority'       => $rec['priority'] ?? 'medium',
                'status'         => $rec['status'] ?? 'open',
                'screenshot_url' => $rec['screenshot_url'],
                'resolution'     => $rec['review_comments'],
                'resolved_at'    => null,
                'reviewed_by'    => $rec['reviewed_by'] ? (int) $rec['reviewed_by'] : null,
                'reviewed_at'    => $rec['reviewed_at'],
                'created_at'     => $rec['created_at'] ?? now(),
                'updated_at'     => $rec['updated_at'] ?? now(),
            ]);
        }

        $this->resetAutoIncrement('issue_reports', $records);
        $this->command->info("  ✓ " . count($records) . " issue reports imported.");
    }

    private function migrateComplaints(): void
    {
        $records = $this->parseTable('=== TABLE: COMPLAINTS');
        $this->command->info("Importing " . count($records) . " complaints...");

        foreach ($records as $rec) {
            DB::table('complaints')->insertOrIgnore([
                'id'                     => (int) $rec['id'],
                'name'                   => $rec['name'],
                'email'                  => $rec['email'],
                'product_manager_name'   => $rec['product_manager_name'],
                'developer_name'         => $rec['developer_name'],
                'technical_manager_name' => $rec['technical_manager_name'],
                'valuable_things'        => $this->cleanJson($rec['valuable_things'] ?? null),
                'detailed_explanation'   => $rec['detailed_explanation'],
                'screenshot_url'         => $rec['screenshot_url'],
                'status'                 => $rec['status'] ?? 'open',
                'review_comments'        => $rec['review_comments'],
                'submitter_id'           => $rec['submitter_id'] ? (int) $rec['submitter_id'] : null,
                'reviewed_by'            => $rec['reviewed_by'] ? (int) $rec['reviewed_by'] : null,
                'reviewed_at'            => $rec['reviewed_at'],
                'created_at'             => $rec['created_at'] ?? now(),
                'updated_at'             => $rec['created_at'] ?? now(),
            ]);
        }

        $this->resetAutoIncrement('complaints', $records);
        $this->command->info("  ✓ " . count($records) . " complaints imported.");
    }

    private function migrateStaffComplaints(): void
    {
        $records = $this->parseTable('=== TABLE: STAFF COMPLAINTS');
        $this->command->info("Importing " . count($records) . " staff complaints...");

        foreach ($records as $rec) {
            DB::table('staff_complaints')->insertOrIgnore([
                'id'                   => (int) $rec['id'],
                'name'                 => $rec['name'],
                'email'                => $rec['email'],
                'department'           => $rec['department'],
                'detailed_explanation' => $rec['detailed_explanation'],
                'screenshot_url'       => $rec['screenshot_url'],
                'status'               => $rec['status'] ?? 'open',
                'review_comments'      => $rec['review_comments'],
                'submitter_id'         => $rec['submitter_id'] ? (int) $rec['submitter_id'] : null,
                'reviewed_at'          => $rec['reviewed_at'],
                'created_at'           => $rec['created_at'] ?? now(),
                'updated_at'           => $rec['created_at'] ?? now(),
            ]);
        }

        $this->resetAutoIncrement('staff_complaints', $records);
        $this->command->info("  ✓ " . count($records) . " staff complaints imported.");
    }

    private function migrateStaffQueries(): void
    {
        // Old schema: id, staff_id, staff_name, department, staff_unique_value,
        //             reason, why_query, attachment_path, likely_penalty,
        //             additional_note, sent_by, status, created_at, updated_at
        // New schema: id, subject, message, submitted_by, assigned_to,
        //             status, response, responded_at, created_at, updated_at
        $records = $this->parseTable('=== TABLE: STAFF QUERIES');
        $this->command->info("Importing " . count($records) . " staff queries...");

        foreach ($records as $rec) {
            DB::table('staff_queries')->insertOrIgnore([
                'id'           => (int) $rec['id'],
                'subject'      => $rec['reason'] ?? $rec['subject'] ?? '(no subject)',
                'message'      => $rec['why_query'] ?? $rec['message'] ?? '',
                'submitted_by' => (int) ($rec['staff_id'] ?? $rec['submitted_by'] ?? 1),
                'assigned_to'  => $rec['sent_by'] ? (int) $rec['sent_by'] : null,
                'status'       => $rec['status'] ?? 'open',
                'response'     => $rec['additional_note'] ?? $rec['response'],
                'responded_at' => null,
                'created_at'   => $rec['created_at'] ?? now(),
                'updated_at'   => $rec['updated_at'] ?? now(),
            ]);
        }

        $this->resetAutoIncrement('staff_queries', $records);
        $this->command->info("  ✓ " . count($records) . " staff queries imported.");
    }

    // =========================================================================
    // PARSER — reads PostgreSQL psql text-output format
    // =========================================================================

    /**
     * Parse a table section from the dump file.
     *
     * The dump uses PostgreSQL's psql \pset format:
     *   === TABLE: NAME ===
     *    col1 | col2 | col3
     *   ------+------+------
     *      v1 |  v2  |  v3
     *
     * Multi-line text fields are indicated by a '+' before the '|' separator.
     * Continuation rows have an empty id column (first column).
     */
    private function parseTable(string $tableMarker): array
    {
        $startLine = -1;
        foreach ($this->lines as $i => $line) {
            if (str_contains($line, $tableMarker)) {
                $startLine = $i;
                break;
            }
        }

        if ($startLine === -1) {
            $this->command->warn("  Section '{$tableMarker}' not found in dump.");
            return [];
        }

        $headerLine = $this->lines[$startLine + 1] ?? '';
        $sepLine    = $this->lines[$startLine + 2] ?? '';

        // Locate column boundaries: positions of '+' in the separator line
        $positions = [];
        for ($j = 0, $len = strlen($sepLine); $j < $len; $j++) {
            if ($sepLine[$j] === '+') {
                $positions[] = $j;
            }
        }

        if (empty($positions)) {
            $this->command->warn("  Could not parse separator for '{$tableMarker}'.");
            return [];
        }

        // Extract column names using same fixed-width positions
        $rawCols = $this->splitByPositions($headerLine, $positions);
        $columns = array_map('trim', $rawCols);

        $records       = [];
        $currentRecord = null;

        for ($i = $startLine + 3, $total = count($this->lines); $i < $total; $i++) {
            $line    = $this->lines[$i];
            $trimmed = trim($line);

            // Stop at the next table section header
            if (str_contains($line, '=== TABLE:')) break;

            // Skip blank lines and separator/footer lines
            if ($trimmed === '') continue;
            if (preg_match('/^[\s\-+()\d\s]+rows?\)?\s*$/', $trimmed)) continue; // "(N rows)" lines
            if (preg_match('/^[-+\s]+$/', $trimmed)) continue;

            $parts  = $this->splitByPositions($line, $positions);
            $idCell = trim($parts[0] ?? '');

            if ($idCell !== '' && ctype_digit($idCell)) {
                // ---- New record ----
                if ($currentRecord !== null) {
                    $records[] = $currentRecord;
                }
                $currentRecord = [];
                foreach ($columns as $k => $col) {
                    if ($col === '') continue;
                    $currentRecord[$col] = $this->extractVal($parts[$k] ?? '');
                }
            } elseif ($currentRecord !== null && $idCell === '') {
                // ---- Continuation row: append non-empty column values ----
                foreach ($columns as $k => $col) {
                    if ($col === '') continue;
                    $val = $this->extractVal($parts[$k] ?? '');
                    if ($val !== null) {
                        $currentRecord[$col] = ($currentRecord[$col] !== null
                            ? $currentRecord[$col] . "\n"
                            : '') . $val;
                    }
                }
            }
        }

        if ($currentRecord !== null) {
            $records[] = $currentRecord;
        }

        return $records;
    }

    /**
     * Split a line into column segments using the fixed-width boundary positions.
     * Each position is where a '|' (data) or '+' (separator) appears.
     */
    private function splitByPositions(string $line, array $positions): array
    {
        $parts = [];
        $prev  = 0;

        foreach ($positions as $pos) {
            $parts[] = substr($line, $prev, $pos - $prev);
            $prev    = $pos + 1; // skip the '|' or '+'
        }

        // Remaining segment after the last boundary
        $parts[] = substr($line, $prev);

        return $parts;
    }

    /**
     * Extract a clean value from a raw column segment.
     * Strips the PostgreSQL continuation marker '+' and surrounding whitespace.
     * Returns null for empty/whitespace-only values.
     */
    private function extractVal(string $rawVal): ?string
    {
        // rtrim to expose any trailing '+' continuation marker
        $rVal      = rtrim($rawVal);
        $continues = strlen($rVal) > 0 && $rVal[-1] === '+';

        if ($continues) {
            $rVal = rtrim(substr($rVal, 0, -1)); // strip the marker
        }

        $val = trim($rVal);

        return $val === '' ? null : $val;
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    /**
     * Reset a table's AUTO_INCREMENT to max(id) + 1 so new inserts don't collide.
     */
    /**
     * Extract a valid JSON string from a possibly-corrupted parsed value.
     * The psql multi-line parser can append trailing `|` or newline artifacts
     * to JSON columns. We take only the first valid JSON token from the value.
     */
    private function cleanJson(?string $val, string $default = '[]'): string
    {
        if ($val === null) return $default;

        // Try the raw value first
        if (json_decode($val) !== null) return $val;

        // Take only the first line (before any appended continuation artifacts)
        $firstLine = trim(explode("\n", $val)[0]);
        if ($firstLine !== '' && json_decode($firstLine) !== null) return $firstLine;

        return $default;
    }

    private function resetAutoIncrement(string $table, array $records): void
    {
        if (empty($records)) return;

        $maxId = max(array_map(fn ($r) => (int) ($r['id'] ?? 0), $records));

        if ($maxId > 0) {
            DB::statement("ALTER TABLE `{$table}` AUTO_INCREMENT = " . ($maxId + 1));
        }
    }
}
