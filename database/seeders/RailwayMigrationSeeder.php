<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Migrates all production data from the Railway PostgreSQL dump (railway_full_dump.sql)
 * into the current MySQL database schema.
 *
 * Run with: php artisan db:seed --class=RailwayMigrationSeeder
 *
 * Prerequisites:
 *  1. DB_CONNECTION=mysql configured in .env
 *  2. Run: php artisan migrate:fresh
 *  3. Then run this seeder.
 */
class RailwayMigrationSeeder extends Seeder
{
    private string $dumpPath = '';

    // Tables to migrate and their transformer callbacks (in dependency order)
    private array $tableMap = [];

    public function run(): void
    {
        $this->dumpPath = base_path('../railway_full_dump.sql');

        if (!file_exists($this->dumpPath)) {
            $this->command->error("Dump not found at: {$this->dumpPath}");
            return;
        }

        $this->buildTableMap();

        $this->command->info('Starting migration...');
        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        try {
            foreach ($this->tableMap as $pgTable => $config) {
                $this->streamTable($pgTable, $config);
            }
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }

        $this->command->newLine();
        $this->command->info('✓ Railway migration complete!');
    }

    private function buildTableMap(): void
    {
        $this->tableMap = [
            'public.users' => [
                'mysql' => 'users',
                'transform' => function (array $r): ?array {
                    $nameParts = explode(' ', trim($r['name'] ?? ''), 2);
                    $accountStatus = ($r['is_active'] ?? 't') === 't' ? 'active' : 'inactive';
                    $workStatus = match ($r['work_status'] ?? 'active') {
                        'on_break' => 'busy', 'absent' => 'on_leave', default => 'available',
                    };
                    return [
                        'id' => (int) $r['id'],
                        'username' => $r['username'],
                        'first_name' => $nameParts[0] ?: ($r['username'] ?? 'Unknown'),
                        'last_name' => $nameParts[1] ?? null,
                        'email' => $r['email'],
                        'password' => $r['password'],
                        'role' => $r['role'],
                        'specialization' => $r['specialization'],
                        'status' => $accountStatus,
                        'work_status' => $workStatus,
                        'must_set_password' => $this->bool($r['must_set_password'] ?? 'f'),
                        'password_setup_token' => $r['password_setup_token'],
                        'current_task_id' => null,
                        'last_active' => $this->ts($r['last_active']),
                        'email_verified_at' => $this->bool($r['email_verified'] ?? 'f') ? $this->ts($r['created_at']) : null,
                        'is_active' => $this->bool($r['is_active'] ?? 't'),
                        'last_seen' => $this->ts($r['last_seen']),
                        'break_count' => (int) ($r['break_count'] ?? 0),
                        'break_start_time' => $this->ts($r['break_start_time']),
                        'break_one_time' => $r['break_one_time'],
                        'task_start_time' => $this->ts($r['task_start_time']),
                        'absence_reason' => ($r['absence_reason'] === 'not_applicable') ? null : $r['absence_reason'],
                        'absence_end_date' => $r['absence_end_date'],
                        'onboarding_status' => $r['onboarding_status'],
                        'product_service' => $r['product_service'],
                        'client_type' => $r['client_type'],
                        'gender' => $r['gender'],
                        'project_manager_type' => $r['project_manager_type'],
                        'verification_token' => $r['verification_token'],
                        'reset_password_token' => $r['reset_password_token'],
                        'reset_password_expires' => $this->ts($r['reset_password_expires']),
                        'created_at' => $this->ts($r['created_at']) ?? now(),
                        'updated_at' => $this->ts($r['created_at']) ?? now(),
                    ];
                },
            ],
            'public.projects' => [
                'mysql' => 'projects',
                'transform' => function (array $r): ?array {
                    $statusMap = ['active'=>'active','pending'=>'active','inactive'=>'inactive','completed'=>'inactive','on_hold'=>'inactive','cancelled'=>'inactive'];
                    return [
                        'id' => (int) $r['id'], 'name' => $r['name'], 'description' => $r['description'],
                        'category' => $r['category'] ?? null,
                        'type' => $r['type'], 'status' => $statusMap[$r['status'] ?? 'active'] ?? 'active',
                        'progress' => (int) ($r['progress'] ?? 0),
                        'client_id' => $r['client_id'] ? (int) $r['client_id'] : null,
                        'manager_id' => $r['manager_id'] ? (int) $r['manager_id'] : null,
                        'start_date' => $r['start_date'] ? date('Y-m-d', strtotime($r['start_date'])) : null,
                        'end_date' => $r['end_date'] ? date('Y-m-d', strtotime($r['end_date'])) : null,
                        'budget' => null,
                        'created_at' => $this->ts($r['created_at']) ?? now(),
                        'updated_at' => $this->ts($r['updated_at']) ?? now(),
                    ];
                },
            ],
            'public.project_members' => [
                'mysql' => 'project_members',
                'dedupe' => 'project_id:user_id',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'project_id' => (int) $r['project_id'],
                    'user_id' => (int) $r['user_id'], 'role' => $r['role'],
                    'invitation_status' => $r['invitation_status'] ?? 'accepted',
                ],
            ],
            'public.tasks' => [
                'mysql' => 'tasks',
                'transform' => function (array $r): ?array {
                    $status = $r['status'] ?? 'todo';
                    if ($status === 'pending') $status = 'todo';
                    $priority = $r['priority'] ?? 'medium';
                    if ($priority === 'urgent') $priority = 'high';
                    return [
                        'id' => (int) $r['id'], 'title' => $r['title'], 'description' => $r['description'],
                        'project_id' => (int) $r['project_id'],
                        'assignee_id' => $r['assignee_id'] ? (int) $r['assignee_id'] : null,
                        'assigned_by' => $r['assigned_by'] ? (int) $r['assigned_by'] : null,
                        'status' => $status, 'priority' => $priority,
                        'progress' => (int) ($r['progress'] ?? 0),
                        'iteration_number' => (int) ($r['iteration_number'] ?? 1),
                        'start_date' => $this->ts($r['start_date']),
                        'deadline' => $this->ts($r['deadline']),
                        'working_hours' => $r['working_hours'] !== null ? (int) $r['working_hours'] : null,
                        'working_minutes' => $r['working_minutes'] !== null ? (int) $r['working_minutes'] : null,
                        'actual_start_time' => $this->ts($r['actual_start_time']),
                        'review_started_at' => $this->ts($r['review_started_at']),
                        'completed_at' => $this->ts($r['completed_at']),
                        'time_spent' => (int) ($r['time_spent'] ?? 0),
                        'is_timer_running' => $this->bool($r['is_timer_running'] ?? 'f'),
                        'timer_start_time' => $this->ts($r['timer_start_time']),
                        'has_been_started' => $this->bool($r['has_been_started'] ?? 'f'),
                        'created_at' => $this->ts($r['created_at']) ?? now(),
                        'updated_at' => $this->ts($r['updated_at']) ?? now(),
                    ];
                },
            ],
            'public.task_sessions' => [
                'mysql' => 'task_sessions',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'task_id' => (int) $r['task_id'], 'user_id' => (int) $r['user_id'],
                    'started_at' => $this->ts($r['start_time']) ?? now(),
                    'ended_at' => $this->ts($r['end_time']),
                    'duration_seconds' => $r['duration'] !== null ? (int) $r['duration'] : null,
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['created_at']) ?? now(),
                ],
            ],
            'public.task_iterations' => [
                'mysql' => 'task_iterations',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'task_id' => (int) $r['task_id'],
                    'title' => "Iteration {$r['iteration_number']}",
                    'description' => $r['description'],
                    'assigned_to' => $r['assignee_id'] ? (int) $r['assignee_id'] : null,
                    'due_date' => $r['deadline'] ? date('Y-m-d', strtotime($r['deadline'])) : null,
                    'status' => $r['status'] ?? 'pending',
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['created_at']) ?? now(),
                ],
            ],
            'public.project_plans' => [
                'mysql' => 'project_plans',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'project_id' => (int) $r['project_id'],
                    'title' => $r['name'], 'description' => $r['description'],
                    'status' => $r['status'] ?? 'draft',
                    'created_by' => $r['created_by'] ? (int) $r['created_by'] : null,
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.deliverables' => [
                'mysql' => 'deliverables',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'plan_id' => (int) $r['project_plan_id'],
                    'title' => $r['name'], 'description' => $r['description'],
                    'due_date' => $r['end_date'] ? date('Y-m-d', strtotime($r['end_date'])) : null,
                    'status' => $r['status'] ?? 'pending', 'dependencies' => $r['dependencies'],
                    'assigned_to' => $r['assignee_id'] ? (int) $r['assignee_id'] : null,
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.project_messages' => [
                'mysql' => 'project_messages',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'project_id' => (int) $r['project_id'],
                    'sender_id' => (int) $r['sender_id'], 'content' => $r['content'],
                    'is_edited' => $this->bool($r['is_edited'] ?? 'f'),
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.message_read_receipts' => [
                'mysql' => 'message_read_receipts',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'message_id' => (int) $r['message_id'],
                    'user_id' => (int) $r['user_id'], 'read_at' => $this->ts($r['read_at']) ?? now(),
                ],
            ],
            'public.direct_messages' => [
                'mysql' => 'direct_messages',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'sender_id' => (int) $r['sender_id'],
                    'receiver_id' => (int) $r['receiver_id'], 'content' => $r['content'],
                    'read' => $this->bool($r['read'] ?? 'f'),
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.general_channel_messages' => [
                'mysql' => 'general_channel_messages',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'content' => $r['content'],
                    'sender_id' => (int) $r['sender_id'],
                    'is_edited' => $this->bool($r['is_edited'] ?? 'f'),
                    'is_pinned' => $this->bool($r['is_pinned'] ?? 'f'),
                    'reactions' => $r['reactions'],
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.general_channel_read_receipts' => [
                'mysql' => 'general_channel_read_receipts',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'message_id' => (int) $r['message_id'],
                    'user_id' => (int) $r['user_id'], 'read_at' => $this->ts($r['read_at']) ?? now(),
                ],
            ],
            'public.notifications' => [
                'mysql' => 'notifications',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'user_id' => (int) $r['user_id'],
                    'type' => $r['type'], 'content' => $r['content'],
                    'reference_id' => $r['reference_id'] ? (int) $r['reference_id'] : null,
                    'reference_type' => $r['reference_type'],
                    'read' => $this->bool($r['read'] ?? 'f'),
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['created_at']) ?? now(),
                ],
            ],
            'public.memos' => [
                'mysql' => 'memos',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'subject' => $r['title'], 'content' => $r['content'],
                    'recipients' => $r['recipients'] ?? '[]', 'sender_id' => (int) $r['sent_by'],
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.memo_reads' => [
                'mysql' => 'memo_reads',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'memo_id' => (int) $r['memo_id'],
                    'user_id' => (int) $r['user_id'], 'read_at' => $this->ts($r['read_at']) ?? now(),
                ],
            ],
            'public.memo_responses' => [
                'mysql' => 'memo_responses',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'memo_id' => (int) $r['memo_id'],
                    'user_id' => (int) $r['user_id'], 'content' => $r['content'],
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.notes' => [
                'mysql' => 'notes',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'title' => $r['title'], 'content' => $r['content'],
                    'todo_items' => $r['todo_items'],
                    'user_id' => (int) ($r['user_id'] ?? $r['created_by']),
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.leave_applications' => [
                'mysql' => 'leave_applications',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'user_id' => (int) $r['user_id'],
                    'leave_type' => $r['leave_type'] ?? 'day_off', 'reason' => $r['reason'],
                    'start_date' => $r['start_date'] ? date('Y-m-d', strtotime($r['start_date'])) : null,
                    'end_date' => $r['end_date'] ? date('Y-m-d', strtotime($r['end_date'])) : null,
                    'proof_image_url' => $r['proof_image_url'], 'status' => $r['status'] ?? 'pending',
                    'applied_at' => $this->ts($r['applied_at']) ?? now(),
                    'reviewed_at' => $this->ts($r['reviewed_at']),
                    'reviewed_by' => $r['reviewed_by'] ? (int) $r['reviewed_by'] : null,
                    'review_comment' => $r['review_comments'],
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.bookings' => [
                'mysql' => 'bookings',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'title' => $r['title'], 'description' => $r['description'],
                    'type' => $r['type'], 'scheduled_by' => (int) $r['scheduled_by'],
                    'participants' => $r['participants'] ?? '[]',
                    'start_time' => $this->ts($r['start_time']) ?? now(),
                    'end_time' => $this->ts($r['end_time']) ?? now(),
                    'status' => $r['status'] ?? 'scheduled', 'location' => null,
                    'meeting_link' => $r['meeting_link'], 'notes' => $r['notes'],
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.resources' => [
                'mysql' => 'resources',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'name' => $r['name'], 'type' => $r['type'],
                    'url' => $r['link'] ?? $r['path'],
                    'size' => $r['size'] ? (int) $r['size'] : null,
                    'project_id' => $r['project_id'] ? (int) $r['project_id'] : null,
                    'uploaded_by' => $r['uploaded_by'] ? (int) $r['uploaded_by'] : null,
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['created_at']) ?? now(),
                ],
            ],
            'public.technical_support_requests' => [
                'mysql' => 'technical_support_requests',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'title' => $r['title'], 'description' => $r['description'],
                    'task_id' => $r['task_id'] ? (int) $r['task_id'] : null,
                    'requester_id' => (int) $r['requester_id'],
                    'assigned_to_id' => $r['assigned_to_id'] ? (int) $r['assigned_to_id'] : null,
                    'status' => $r['status'] ?? 'open',
                    'priority' => in_array($r['priority'] ?? 'medium', ['low','medium','high']) ? $r['priority'] : 'medium',
                    'resolution' => $r['resolution'], 'resolved_at' => $this->ts($r['resolved_at']),
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.deadline_extension_requests' => [
                'mysql' => 'deadline_extension_requests',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'task_id' => (int) $r['task_id'],
                    'requester_id' => (int) $r['requester_id'],
                    'project_manager_id' => $r['project_manager_id'] ? (int) $r['project_manager_id'] : null,
                    'reason' => $r['reason'],
                    'requested_deadline' => $r['requested_deadline'] ? date('Y-m-d', strtotime($r['requested_deadline'])) : null,
                    'status' => $r['status'] ?? 'pending', 'decision_reason' => $r['decision_reason'],
                    'decided_by' => $r['decided_by'] ? (int) $r['decided_by'] : null,
                    'decided_at' => $this->ts($r['decided_at']),
                    'approved_deadline' => $r['approved_deadline'] ? date('Y-m-d', strtotime($r['approved_deadline'])) : null,
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.complaints' => [
                'mysql' => 'complaints',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'name' => $r['name'], 'email' => $r['email'],
                    'product_manager_name' => $r['product_manager_name'],
                    'developer_name' => $r['developer_name'],
                    'technical_manager_name' => $r['technical_manager_name'],
                    'valuable_things' => $r['valuable_things'] ?? '[]',
                    'detailed_explanation' => $r['detailed_explanation'],
                    'screenshot_url' => $r['screenshot_url'], 'status' => $r['status'] ?? 'open',
                    'review_comments' => $r['review_comments'],
                    'submitter_id' => $r['submitter_id'] ? (int) $r['submitter_id'] : null,
                    'reviewed_by' => $r['reviewed_by'] ? (int) $r['reviewed_by'] : null,
                    'reviewed_at' => $this->ts($r['reviewed_at']),
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['created_at']) ?? now(),
                ],
            ],
            'public.staff_complaints' => [
                'mysql' => 'staff_complaints',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'name' => $r['name'], 'email' => $r['email'],
                    'department' => $r['department'], 'detailed_explanation' => $r['detailed_explanation'],
                    'screenshot_url' => $r['screenshot_url'], 'status' => $r['status'] ?? 'open',
                    'review_comments' => $r['review_comments'],
                    'submitter_id' => $r['submitter_id'] ? (int) $r['submitter_id'] : null,
                    'reviewed_at' => $this->ts($r['reviewed_at']),
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['created_at']) ?? now(),
                ],
            ],
            'public.staff_queries' => [
                'mysql' => 'staff_queries',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'subject' => $r['reason'] ?? '(no subject)',
                    'message' => $r['why_query'] ?? '',
                    'submitted_by' => (int) ($r['staff_id'] ?? 1),
                    'assigned_to' => $r['sent_by'] ? (int) $r['sent_by'] : null,
                    'status' => $r['status'] ?? 'open', 'response' => $r['additional_note'],
                    'responded_at' => null,
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.issue_reports' => [
                'mysql' => 'issue_reports',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'title' => $r['title'], 'description' => $r['description'],
                    'reported_by' => $r['submitter_id'] ? (int) $r['submitter_id'] : null,
                    'project_id' => null, 'task_id' => null,
                    'priority' => $r['priority'] ?? 'medium', 'status' => $r['status'] ?? 'open',
                    'screenshot_url' => $r['screenshot_url'], 'resolution' => $r['review_comments'],
                    'resolved_at' => null,
                    'reviewed_by' => $r['reviewed_by'] ? (int) $r['reviewed_by'] : null,
                    'reviewed_at' => $this->ts($r['reviewed_at']),
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.review_links' => [
                'mysql' => 'review_links',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'title' => $r['title'], 'link_url' => $r['link_url'],
                    'description' => $r['description'], 'sent_by' => (int) $r['sent_by'],
                    'assigned_to' => $r['assigned_to'] ? (int) $r['assigned_to'] : null,
                    'status' => $r['status'] ?? 'pending', 'reviewed_at' => $this->ts($r['reviewed_at']),
                    'review_comment' => $r['review_comment'],
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.sops' => [
                'mysql' => 'sops',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'title' => $r['title'],
                    'description' => $r['reference_link'], 'category' => $r['department'],
                    'status' => 'active',
                    'created_by' => $r['created_by'] ? (int) $r['created_by'] : null,
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.sop_segments' => [
                'mysql' => 'sop_segments',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'sop_id' => (int) $r['sop_id'],
                    'title' => $r['title'], 'content' => $r['content'],
                    'order_index' => (int) ($r['segment_order'] ?? 0),
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['updated_at']) ?? now(),
                ],
            ],
            'public.client_invitations' => [
                'mysql' => 'client_invitations',
                'transform' => fn(array $r): ?array => [
                    'id' => (int) $r['id'], 'email' => $r['email'],
                    'project_id' => $r['project_id'] ? (int) $r['project_id'] : null,
                    'invited_by' => $r['invited_by'] ? (int) $r['invited_by'] : null,
                    'token' => $r['token'], 'status' => $r['status'] ?? 'pending',
                    'expires_at' => $this->ts($r['expires_at']) ?? now(),
                    'created_at' => $this->ts($r['created_at']) ?? now(),
                    'updated_at' => $this->ts($r['created_at']) ?? now(),
                ],
            ],
        ];
    }

    // =========================================================================
    // STREAMING IMPORTER
    // =========================================================================

    private function streamTable(string $pgTable, array $config): void
    {
        $mysqlTable = $config['mysql'];
        $transform  = $config['transform'];
        $dedupeKey  = $config['dedupe'] ?? null;

        $handle = fopen($this->dumpPath, 'r');
        if (!$handle) return;

        $inTarget   = false;
        $columns    = [];
        $chunk      = [];
        $seen       = [];
        $count      = 0;
        $maxId      = 0;

        while (($line = fgets($handle)) !== false) {
            $line = rtrim($line, "\r\n");

            if (!$inTarget) {
                if (preg_match('/^COPY ' . preg_quote($pgTable, '/') . ' \(([^)]+)\) FROM stdin;/', $line, $m)) {
                    $columns  = array_map('trim', explode(',', $m[1]));
                    $inTarget = true;
                }
                continue;
            }

            if ($line === '\\.') break;

            $values = explode("\t", $line);
            $row    = [];
            foreach ($columns as $i => $col) {
                $row[$col] = $this->unescape($values[$i] ?? null);
            }

            // Deduplicate if needed
            if ($dedupeKey) {
                $keys   = explode(':', $dedupeKey);
                $keyVal = implode(':', array_map(fn($k) => $row[$k] ?? '', $keys));
                if (isset($seen[$keyVal])) continue;
                $seen[$keyVal] = true;
            }

            $record = $transform($row);
            if ($record === null) continue;

            if (isset($record['id']) && $record['id'] > $maxId) {
                $maxId = $record['id'];
            }

            $chunk[] = $record;
            $count++;

            if (count($chunk) >= 100) {
                DB::table($mysqlTable)->insertOrIgnore($chunk);
                $chunk = [];
            }
        }

        if (!empty($chunk)) {
            DB::table($mysqlTable)->insertOrIgnore($chunk);
        }

        fclose($handle);

        if ($maxId > 0) {
            DB::statement("ALTER TABLE `{$mysqlTable}` AUTO_INCREMENT = " . ($maxId + 1));
        }

        $this->command->info("  ✓ {$count} rows → {$mysqlTable}");
    }

    // =========================================================================
    // LEGACY METHODS (kept for reference, no longer called)
    // =========================================================================

    private function migrateUsers(): void
    {
        $rows = $this->getRows('public.users');
        $this->command->info("Importing {$rows['count']} users...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $nameParts = explode(' ', trim($r['name'] ?? ''), 2);
            $firstName = $nameParts[0] ?: ($r['username'] ?? 'Unknown');
            $lastName  = $nameParts[1] ?? null;

            $accountStatus = ($r['is_active'] ?? 't') === 't' ? 'active' : 'inactive';
            $workStatus    = match ($r['work_status'] ?? 'active') {
                'on_break' => 'busy',
                'absent'   => 'on_leave',
                default    => 'available',
            };

            $records[] = [
                'id'                     => (int) $r['id'],
                'username'               => $r['username'],
                'first_name'             => $firstName,
                'last_name'              => $lastName,
                'email'                  => $r['email'],
                'password'               => $r['password'],
                'role'                   => $r['role'],
                'specialization'         => $r['specialization'],
                'status'                 => $accountStatus,
                'work_status'            => $workStatus,
                'must_set_password'      => $this->bool($r['must_set_password'] ?? 'f'),
                'password_setup_token'   => $r['password_setup_token'],
                'current_task_id'        => null,
                'last_active'            => $this->ts($r['last_active']),
                'email_verified_at'      => $this->bool($r['email_verified'] ?? 'f') ? $this->ts($r['created_at']) : null,
                'is_active'              => $this->bool($r['is_active'] ?? 't'),
                'last_seen'              => $this->ts($r['last_seen']),
                'break_count'            => (int) ($r['break_count'] ?? 0),
                'break_start_time'       => $this->ts($r['break_start_time']),
                'break_one_time'         => $r['break_one_time'],
                'task_start_time'        => $this->ts($r['task_start_time']),
                'absence_reason'         => $r['absence_reason'] === 'not_applicable' ? null : $r['absence_reason'],
                'absence_end_date'       => $r['absence_end_date'],
                'onboarding_status'      => $r['onboarding_status'],
                'product_service'        => $r['product_service'],
                'client_type'            => $r['client_type'],
                'gender'                 => $r['gender'],
                'project_manager_type'   => $r['project_manager_type'],
                'verification_token'     => $r['verification_token'],
                'reset_password_token'   => $r['reset_password_token'],
                'reset_password_expires' => $this->ts($r['reset_password_expires']),
                'created_at'             => $this->ts($r['created_at']) ?? now(),
                'updated_at'             => $this->ts($r['created_at']) ?? now(),
            ];
        }

        $this->insertChunked('users', $records);
        $this->resetAutoIncrement('users', $records);
        $this->command->info("  ✓ {$rows['count']} users imported.");
    }

    private function migrateProjects(): void
    {
        $rows = $this->getRows('public.projects');
        $this->command->info("Importing {$rows['count']} projects...");

        $statusMap = ['active' => 'active', 'pending' => 'active', 'inactive' => 'inactive',
                      'completed' => 'inactive', 'on_hold' => 'inactive', 'cancelled' => 'inactive'];

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'          => (int) $r['id'],
                'name'        => $r['name'],
                'description' => $r['description'],
                'type'        => $r['type'],
                'status'      => $statusMap[$r['status'] ?? 'active'] ?? 'active',
                'progress'    => (int) ($r['progress'] ?? 0),
                'client_id'   => $r['client_id'] ? (int) $r['client_id'] : null,
                'manager_id'  => $r['manager_id'] ? (int) $r['manager_id'] : null,
                'start_date'  => $r['start_date'] ? date('Y-m-d', strtotime($r['start_date'])) : null,
                'end_date'    => $r['end_date'] ? date('Y-m-d', strtotime($r['end_date'])) : null,
                'budget'      => null,
                'created_at'  => $this->ts($r['created_at']) ?? now(),
                'updated_at'  => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('projects', $records);
        $this->resetAutoIncrement('projects', $records);
        $this->command->info("  ✓ {$rows['count']} projects imported.");
    }

    private function migrateProjectMembers(): void
    {
        $rows = $this->getRows('public.project_members');
        $this->command->info("Importing {$rows['count']} project members...");

        $seen = [];
        $records = [];
        foreach ($rows['data'] as $r) {
            $key = "{$r['project_id']}:{$r['user_id']}";
            if (isset($seen[$key])) continue;
            $seen[$key] = true;

            $records[] = [
                'id'                => (int) $r['id'],
                'project_id'        => (int) $r['project_id'],
                'user_id'           => (int) $r['user_id'],
                'role'              => $r['role'],
                'invitation_status' => $r['invitation_status'] ?? 'accepted',
            ];
        }

        $this->insertChunked('project_members', $records);
        $this->resetAutoIncrement('project_members', $records);
        $this->command->info("  ✓ " . count($records) . " project members imported.");
    }

    private function migrateTasks(): void
    {
        $rows = $this->getRows('public.tasks');
        $this->command->info("Importing {$rows['count']} tasks...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $status   = $r['status'] ?? 'todo';
            if ($status === 'pending') $status = 'todo';
            $priority = $r['priority'] ?? 'medium';
            if ($priority === 'urgent') $priority = 'high';

            $records[] = [
                'id'               => (int) $r['id'],
                'title'            => $r['title'],
                'description'      => $r['description'],
                'project_id'       => (int) $r['project_id'],
                'assignee_id'      => $r['assignee_id'] ? (int) $r['assignee_id'] : null,
                'assigned_by'      => $r['assigned_by'] ? (int) $r['assigned_by'] : null,
                'status'           => $status,
                'priority'         => $priority,
                'progress'         => (int) ($r['progress'] ?? 0),
                'iteration_number' => (int) ($r['iteration_number'] ?? 1),
                'start_date'       => $this->ts($r['start_date']),
                'deadline'         => $this->ts($r['deadline']),
                'working_hours'    => $r['working_hours'] !== null ? (int) $r['working_hours'] : null,
                'working_minutes'  => $r['working_minutes'] !== null ? (int) $r['working_minutes'] : null,
                'actual_start_time'=> $this->ts($r['actual_start_time']),
                'review_started_at'=> $this->ts($r['review_started_at']),
                'completed_at'     => $this->ts($r['completed_at']),
                'time_spent'       => (int) ($r['time_spent'] ?? 0),
                'is_timer_running' => $this->bool($r['is_timer_running'] ?? 'f'),
                'timer_start_time' => $this->ts($r['timer_start_time']),
                'has_been_started' => $this->bool($r['has_been_started'] ?? 'f'),
                'created_at'       => $this->ts($r['created_at']) ?? now(),
                'updated_at'       => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('tasks', $records);
        $this->resetAutoIncrement('tasks', $records);
        $this->command->info("  ✓ {$rows['count']} tasks imported.");
    }

    private function migrateTaskSessions(): void
    {
        $rows = $this->getRows('public.task_sessions');
        $this->command->info("Importing {$rows['count']} task sessions...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'               => (int) $r['id'],
                'task_id'          => (int) $r['task_id'],
                'user_id'          => (int) $r['user_id'],
                'started_at'       => $this->ts($r['start_time']) ?? now(),
                'ended_at'         => $this->ts($r['end_time']),
                'duration_seconds' => $r['duration'] !== null ? (int) $r['duration'] : null,
                'created_at'       => $this->ts($r['created_at']) ?? now(),
                'updated_at'       => $this->ts($r['created_at']) ?? now(),
            ];
        }

        $this->insertChunked('task_sessions', $records);
        $this->resetAutoIncrement('task_sessions', $records);
        $this->command->info("  ✓ {$rows['count']} task sessions imported.");
    }

    private function migrateTaskIterations(): void
    {
        $rows = $this->getRows('public.task_iterations');
        $this->command->info("Importing {$rows['count']} task iterations...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'          => (int) $r['id'],
                'task_id'     => (int) $r['task_id'],
                'title'       => "Iteration {$r['iteration_number']}",
                'description' => $r['description'],
                'assigned_to' => $r['assignee_id'] ? (int) $r['assignee_id'] : null,
                'due_date'    => $r['deadline'] ? date('Y-m-d', strtotime($r['deadline'])) : null,
                'status'      => $r['status'] ?? 'pending',
                'created_at'  => $this->ts($r['created_at']) ?? now(),
                'updated_at'  => $this->ts($r['created_at']) ?? now(),
            ];
        }

        $this->insertChunked('task_iterations', $records);
        $this->resetAutoIncrement('task_iterations', $records);
        $this->command->info("  ✓ {$rows['count']} task iterations imported.");
    }

    private function migrateProjectPlans(): void
    {
        $rows = $this->getRows('public.project_plans');
        $this->command->info("Importing {$rows['count']} project plans...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'          => (int) $r['id'],
                'project_id'  => (int) $r['project_id'],
                'title'       => $r['name'],
                'description' => $r['description'],
                'status'      => $r['status'] ?? 'draft',
                'created_by'  => $r['created_by'] ? (int) $r['created_by'] : null,
                'created_at'  => $this->ts($r['created_at']) ?? now(),
                'updated_at'  => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('project_plans', $records);
        $this->resetAutoIncrement('project_plans', $records);
        $this->command->info("  ✓ {$rows['count']} project plans imported.");
    }

    private function migrateDeliverables(): void
    {
        $rows = $this->getRows('public.deliverables');
        $this->command->info("Importing {$rows['count']} deliverables...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'          => (int) $r['id'],
                'plan_id'     => (int) $r['project_plan_id'],
                'title'       => $r['name'],
                'description' => $r['description'],
                'due_date'    => $r['end_date'] ? date('Y-m-d', strtotime($r['end_date'])) : null,
                'status'      => $r['status'] ?? 'pending',
                'dependencies'=> $r['dependencies'],
                'assigned_to' => $r['assignee_id'] ? (int) $r['assignee_id'] : null,
                'created_at'  => $this->ts($r['created_at']) ?? now(),
                'updated_at'  => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('deliverables', $records);
        $this->resetAutoIncrement('deliverables', $records);
        $this->command->info("  ✓ {$rows['count']} deliverables imported.");
    }

    private function migrateProjectMessages(): void
    {
        $rows = $this->getRows('public.project_messages');
        $this->command->info("Importing {$rows['count']} project messages...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'         => (int) $r['id'],
                'project_id' => (int) $r['project_id'],
                'sender_id'  => (int) $r['sender_id'],
                'content'    => $r['content'],
                'is_edited'  => $this->bool($r['is_edited'] ?? 'f'),
                'created_at' => $this->ts($r['created_at']) ?? now(),
                'updated_at' => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('project_messages', $records);
        $this->resetAutoIncrement('project_messages', $records);
        $this->command->info("  ✓ {$rows['count']} project messages imported.");
    }

    private function migrateMessageReadReceipts(): void
    {
        $rows = $this->getRows('public.message_read_receipts');
        $this->command->info("Importing {$rows['count']} message read receipts...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'         => (int) $r['id'],
                'message_id' => (int) $r['message_id'],
                'user_id'    => (int) $r['user_id'],
                'read_at'    => $this->ts($r['read_at']) ?? now(),
            ];
        }

        $this->insertChunked('message_read_receipts', $records);
        $this->resetAutoIncrement('message_read_receipts', $records);
        $this->command->info("  ✓ {$rows['count']} message read receipts imported.");
    }

    private function migrateDirectMessages(): void
    {
        $rows = $this->getRows('public.direct_messages');
        $this->command->info("Importing {$rows['count']} direct messages...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'          => (int) $r['id'],
                'sender_id'   => (int) $r['sender_id'],
                'receiver_id' => (int) $r['receiver_id'],
                'content'     => $r['content'],
                'read'        => $this->bool($r['read'] ?? 'f'),
                'created_at'  => $this->ts($r['created_at']) ?? now(),
                'updated_at'  => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('direct_messages', $records);
        $this->resetAutoIncrement('direct_messages', $records);
        $this->command->info("  ✓ {$rows['count']} direct messages imported.");
    }

    private function migrateGeneralChannelMessages(): void
    {
        $rows = $this->getRows('public.general_channel_messages');
        $this->command->info("Importing {$rows['count']} general channel messages...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'         => (int) $r['id'],
                'content'    => $r['content'],
                'sender_id'  => (int) $r['sender_id'],
                'is_edited'  => $this->bool($r['is_edited'] ?? 'f'),
                'is_pinned'  => $this->bool($r['is_pinned'] ?? 'f'),
                'reactions'  => $r['reactions'],
                'created_at' => $this->ts($r['created_at']) ?? now(),
                'updated_at' => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('general_channel_messages', $records);
        $this->resetAutoIncrement('general_channel_messages', $records);
        $this->command->info("  ✓ {$rows['count']} general channel messages imported.");
    }

    private function migrateGeneralChannelReadReceipts(): void
    {
        $rows = $this->getRows('public.general_channel_read_receipts');
        $this->command->info("Importing {$rows['count']} general channel read receipts...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'         => (int) $r['id'],
                'message_id' => (int) $r['message_id'],
                'user_id'    => (int) $r['user_id'],
                'read_at'    => $this->ts($r['read_at']) ?? now(),
            ];
        }

        $this->insertChunked('general_channel_read_receipts', $records);
        $this->resetAutoIncrement('general_channel_read_receipts', $records);
        $this->command->info("  ✓ {$rows['count']} general channel read receipts imported.");
    }

    private function migrateNotifications(): void
    {
        $rows = $this->getRows('public.notifications');
        $this->command->info("Importing {$rows['count']} notifications...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'             => (int) $r['id'],
                'user_id'        => (int) $r['user_id'],
                'type'           => $r['type'],
                'content'        => $r['content'],
                'reference_id'   => $r['reference_id'] ? (int) $r['reference_id'] : null,
                'reference_type' => $r['reference_type'],
                'read'           => $this->bool($r['read'] ?? 'f'),
                'created_at'     => $this->ts($r['created_at']) ?? now(),
                'updated_at'     => $this->ts($r['created_at']) ?? now(),
            ];
        }

        $this->insertChunked('notifications', $records);
        $this->resetAutoIncrement('notifications', $records);
        $this->command->info("  ✓ {$rows['count']} notifications imported.");
    }

    private function migrateMemos(): void
    {
        $rows = $this->getRows('public.memos');
        $this->command->info("Importing {$rows['count']} memos...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'         => (int) $r['id'],
                'subject'    => $r['title'],
                'content'    => $r['content'],
                'recipients' => $r['recipients'] ?? '[]',
                'sender_id'  => (int) $r['sent_by'],
                'created_at' => $this->ts($r['created_at']) ?? now(),
                'updated_at' => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('memos', $records);
        $this->resetAutoIncrement('memos', $records);
        $this->command->info("  ✓ {$rows['count']} memos imported.");
    }

    private function migrateMemoReads(): void
    {
        $rows = $this->getRows('public.memo_reads');
        $this->command->info("Importing {$rows['count']} memo reads...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'      => (int) $r['id'],
                'memo_id' => (int) $r['memo_id'],
                'user_id' => (int) $r['user_id'],
                'read_at' => $this->ts($r['read_at']) ?? now(),
            ];
        }

        $this->insertChunked('memo_reads', $records);
        $this->resetAutoIncrement('memo_reads', $records);
        $this->command->info("  ✓ {$rows['count']} memo reads imported.");
    }

    private function migrateMemoResponses(): void
    {
        $rows = $this->getRows('public.memo_responses');
        $this->command->info("Importing {$rows['count']} memo responses...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'         => (int) $r['id'],
                'memo_id'    => (int) $r['memo_id'],
                'user_id'    => (int) $r['user_id'],
                'content'    => $r['content'],
                'created_at' => $this->ts($r['created_at']) ?? now(),
                'updated_at' => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('memo_responses', $records);
        $this->resetAutoIncrement('memo_responses', $records);
        $this->command->info("  ✓ {$rows['count']} memo responses imported.");
    }

    private function migrateNotes(): void
    {
        $rows = $this->getRows('public.notes');
        $this->command->info("Importing {$rows['count']} notes...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'         => (int) $r['id'],
                'title'      => $r['title'],
                'content'    => $r['content'],
                'todo_items' => $r['todo_items'],
                'user_id'    => (int) ($r['user_id'] ?? $r['created_by']),
                'created_at' => $this->ts($r['created_at']) ?? now(),
                'updated_at' => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('notes', $records);
        $this->resetAutoIncrement('notes', $records);
        $this->command->info("  ✓ {$rows['count']} notes imported.");
    }

    private function migrateLeaveApplications(): void
    {
        $rows = $this->getRows('public.leave_applications');
        $this->command->info("Importing {$rows['count']} leave applications...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'             => (int) $r['id'],
                'user_id'        => (int) $r['user_id'],
                'leave_type'     => $r['leave_type'] ?? 'day_off',
                'reason'         => $r['reason'],
                'start_date'     => $r['start_date'] ? date('Y-m-d', strtotime($r['start_date'])) : null,
                'end_date'       => $r['end_date'] ? date('Y-m-d', strtotime($r['end_date'])) : null,
                'proof_image_url'=> $r['proof_image_url'],
                'status'         => $r['status'] ?? 'pending',
                'applied_at'     => $this->ts($r['applied_at']) ?? now(),
                'reviewed_at'    => $this->ts($r['reviewed_at']),
                'reviewed_by'    => $r['reviewed_by'] ? (int) $r['reviewed_by'] : null,
                'review_comment' => $r['review_comments'],
                'created_at'     => $this->ts($r['created_at']) ?? now(),
                'updated_at'     => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('leave_applications', $records);
        $this->resetAutoIncrement('leave_applications', $records);
        $this->command->info("  ✓ {$rows['count']} leave applications imported.");
    }

    private function migrateBookings(): void
    {
        $rows = $this->getRows('public.bookings');
        $this->command->info("Importing {$rows['count']} bookings...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'           => (int) $r['id'],
                'title'        => $r['title'],
                'description'  => $r['description'],
                'type'         => $r['type'],
                'scheduled_by' => (int) $r['scheduled_by'],
                'participants' => $r['participants'] ?? '[]',
                'start_time'   => $this->ts($r['start_time']) ?? now(),
                'end_time'     => $this->ts($r['end_time']) ?? now(),
                'status'       => $r['status'] ?? 'scheduled',
                'location'     => null,
                'meeting_link' => $r['meeting_link'],
                'notes'        => $r['notes'],
                'created_at'   => $this->ts($r['created_at']) ?? now(),
                'updated_at'   => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('bookings', $records);
        $this->resetAutoIncrement('bookings', $records);
        $this->command->info("  ✓ {$rows['count']} bookings imported.");
    }

    private function migrateResources(): void
    {
        $rows = $this->getRows('public.resources');
        $this->command->info("Importing {$rows['count']} resources...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'          => (int) $r['id'],
                'name'        => $r['name'],
                'type'        => $r['type'],
                'url'         => $r['link'] ?? $r['path'],
                'size'        => $r['size'] ? (int) $r['size'] : null,
                'project_id'  => $r['project_id'] ? (int) $r['project_id'] : null,
                'uploaded_by' => $r['uploaded_by'] ? (int) $r['uploaded_by'] : null,
                'created_at'  => $this->ts($r['created_at']) ?? now(),
                'updated_at'  => $this->ts($r['created_at']) ?? now(),
            ];
        }

        $this->insertChunked('resources', $records);
        $this->resetAutoIncrement('resources', $records);
        $this->command->info("  ✓ {$rows['count']} resources imported.");
    }

    private function migrateTechnicalSupportRequests(): void
    {
        $rows = $this->getRows('public.technical_support_requests');
        $this->command->info("Importing {$rows['count']} technical support requests...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'             => (int) $r['id'],
                'title'          => $r['title'],
                'description'    => $r['description'],
                'task_id'        => $r['task_id'] ? (int) $r['task_id'] : null,
                'requester_id'   => (int) $r['requester_id'],
                'assigned_to_id' => $r['assigned_to_id'] ? (int) $r['assigned_to_id'] : null,
                'status'         => $r['status'] ?? 'open',
                'priority'       => in_array($r['priority'] ?? 'medium', ['low','medium','high']) ? $r['priority'] : 'medium',
                'resolution'     => $r['resolution'],
                'resolved_at'    => $this->ts($r['resolved_at']),
                'created_at'     => $this->ts($r['created_at']) ?? now(),
                'updated_at'     => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('technical_support_requests', $records);
        $this->resetAutoIncrement('technical_support_requests', $records);
        $this->command->info("  ✓ {$rows['count']} technical support requests imported.");
    }

    private function migrateDeadlineExtensionRequests(): void
    {
        $rows = $this->getRows('public.deadline_extension_requests');
        $this->command->info("Importing {$rows['count']} deadline extension requests...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'                 => (int) $r['id'],
                'task_id'            => (int) $r['task_id'],
                'requester_id'       => (int) $r['requester_id'],
                'project_manager_id' => $r['project_manager_id'] ? (int) $r['project_manager_id'] : null,
                'reason'             => $r['reason'],
                'requested_deadline' => $r['requested_deadline'] ? date('Y-m-d', strtotime($r['requested_deadline'])) : null,
                'status'             => $r['status'] ?? 'pending',
                'decision_reason'    => $r['decision_reason'],
                'decided_by'         => $r['decided_by'] ? (int) $r['decided_by'] : null,
                'decided_at'         => $this->ts($r['decided_at']),
                'approved_deadline'  => $r['approved_deadline'] ? date('Y-m-d', strtotime($r['approved_deadline'])) : null,
                'created_at'         => $this->ts($r['created_at']) ?? now(),
                'updated_at'         => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('deadline_extension_requests', $records);
        $this->resetAutoIncrement('deadline_extension_requests', $records);
        $this->command->info("  ✓ {$rows['count']} deadline extension requests imported.");
    }

    private function migrateComplaints(): void
    {
        $rows = $this->getRows('public.complaints');
        $this->command->info("Importing {$rows['count']} complaints...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'                     => (int) $r['id'],
                'name'                   => $r['name'],
                'email'                  => $r['email'],
                'product_manager_name'   => $r['product_manager_name'],
                'developer_name'         => $r['developer_name'],
                'technical_manager_name' => $r['technical_manager_name'],
                'valuable_things'        => $r['valuable_things'] ?? '[]',
                'detailed_explanation'   => $r['detailed_explanation'],
                'screenshot_url'         => $r['screenshot_url'],
                'status'                 => $r['status'] ?? 'open',
                'review_comments'        => $r['review_comments'],
                'submitter_id'           => $r['submitter_id'] ? (int) $r['submitter_id'] : null,
                'reviewed_by'            => $r['reviewed_by'] ? (int) $r['reviewed_by'] : null,
                'reviewed_at'            => $this->ts($r['reviewed_at']),
                'created_at'             => $this->ts($r['created_at']) ?? now(),
                'updated_at'             => $this->ts($r['created_at']) ?? now(),
            ];
        }

        $this->insertChunked('complaints', $records);
        $this->resetAutoIncrement('complaints', $records);
        $this->command->info("  ✓ {$rows['count']} complaints imported.");
    }

    private function migrateStaffComplaints(): void
    {
        $rows = $this->getRows('public.staff_complaints');
        $this->command->info("Importing {$rows['count']} staff complaints...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'                   => (int) $r['id'],
                'name'                 => $r['name'],
                'email'                => $r['email'],
                'department'           => $r['department'],
                'detailed_explanation' => $r['detailed_explanation'],
                'screenshot_url'       => $r['screenshot_url'],
                'status'               => $r['status'] ?? 'open',
                'review_comments'      => $r['review_comments'],
                'submitter_id'         => $r['submitter_id'] ? (int) $r['submitter_id'] : null,
                'reviewed_at'          => $this->ts($r['reviewed_at']),
                'created_at'           => $this->ts($r['created_at']) ?? now(),
                'updated_at'           => $this->ts($r['created_at']) ?? now(),
            ];
        }

        $this->insertChunked('staff_complaints', $records);
        $this->resetAutoIncrement('staff_complaints', $records);
        $this->command->info("  ✓ {$rows['count']} staff complaints imported.");
    }

    private function migrateStaffQueries(): void
    {
        $rows = $this->getRows('public.staff_queries');
        $this->command->info("Importing {$rows['count']} staff queries...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'           => (int) $r['id'],
                'subject'      => $r['reason'] ?? '(no subject)',
                'message'      => $r['why_query'] ?? '',
                'submitted_by' => (int) ($r['staff_id'] ?? 1),
                'assigned_to'  => $r['sent_by'] ? (int) $r['sent_by'] : null,
                'status'       => $r['status'] ?? 'open',
                'response'     => $r['additional_note'],
                'responded_at' => null,
                'created_at'   => $this->ts($r['created_at']) ?? now(),
                'updated_at'   => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('staff_queries', $records);
        $this->resetAutoIncrement('staff_queries', $records);
        $this->command->info("  ✓ {$rows['count']} staff queries imported.");
    }

    private function migrateIssueReports(): void
    {
        $rows = $this->getRows('public.issue_reports');
        $this->command->info("Importing {$rows['count']} issue reports...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'             => (int) $r['id'],
                'title'          => $r['title'],
                'description'    => $r['description'],
                'reported_by'    => $r['submitter_id'] ? (int) $r['submitter_id'] : null,
                'project_id'     => null,
                'task_id'        => null,
                'priority'       => $r['priority'] ?? 'medium',
                'status'         => $r['status'] ?? 'open',
                'screenshot_url' => $r['screenshot_url'],
                'resolution'     => $r['review_comments'],
                'resolved_at'    => null,
                'reviewed_by'    => $r['reviewed_by'] ? (int) $r['reviewed_by'] : null,
                'reviewed_at'    => $this->ts($r['reviewed_at']),
                'created_at'     => $this->ts($r['created_at']) ?? now(),
                'updated_at'     => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('issue_reports', $records);
        $this->resetAutoIncrement('issue_reports', $records);
        $this->command->info("  ✓ {$rows['count']} issue reports imported.");
    }

    private function migrateReviewLinks(): void
    {
        $rows = $this->getRows('public.review_links');
        $this->command->info("Importing {$rows['count']} review links...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'             => (int) $r['id'],
                'title'          => $r['title'],
                'link_url'       => $r['link_url'],
                'description'    => $r['description'],
                'sent_by'        => (int) $r['sent_by'],
                'assigned_to'    => $r['assigned_to'] ? (int) $r['assigned_to'] : null,
                'status'         => $r['status'] ?? 'pending',
                'reviewed_at'    => $this->ts($r['reviewed_at']),
                'review_comment' => $r['review_comment'],
                'created_at'     => $this->ts($r['created_at']) ?? now(),
                'updated_at'     => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('review_links', $records);
        $this->resetAutoIncrement('review_links', $records);
        $this->command->info("  ✓ {$rows['count']} review links imported.");
    }

    private function migrateSops(): void
    {
        $rows = $this->getRows('public.sops');
        $this->command->info("Importing {$rows['count']} SOPs...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'          => (int) $r['id'],
                'title'       => $r['title'],
                'description' => $r['reference_link'],
                'category'    => $r['department'],
                'status'      => 'active',
                'created_by'  => $r['created_by'] ? (int) $r['created_by'] : null,
                'created_at'  => $this->ts($r['created_at']) ?? now(),
                'updated_at'  => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('sops', $records);
        $this->resetAutoIncrement('sops', $records);
        $this->command->info("  ✓ {$rows['count']} SOPs imported.");
    }

    private function migrateSopSegments(): void
    {
        $rows = $this->getRows('public.sop_segments');
        $this->command->info("Importing {$rows['count']} SOP segments...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'          => (int) $r['id'],
                'sop_id'      => (int) $r['sop_id'],
                'title'       => $r['title'],
                'content'     => $r['content'],
                'order_index' => (int) ($r['segment_order'] ?? 0),
                'created_at'  => $this->ts($r['created_at']) ?? now(),
                'updated_at'  => $this->ts($r['updated_at']) ?? now(),
            ];
        }

        $this->insertChunked('sop_segments', $records);
        $this->resetAutoIncrement('sop_segments', $records);
        $this->command->info("  ✓ {$rows['count']} SOP segments imported.");
    }

    private function migrateClientInvitations(): void
    {
        $rows = $this->getRows('public.client_invitations');
        $this->command->info("Importing {$rows['count']} client invitations...");

        $records = [];
        foreach ($rows['data'] as $r) {
            $records[] = [
                'id'         => (int) $r['id'],
                'email'      => $r['email'],
                'project_id' => $r['project_id'] ? (int) $r['project_id'] : null,
                'invited_by' => $r['invited_by'] ? (int) $r['invited_by'] : null,
                'token'      => $r['token'],
                'status'     => $r['status'] ?? 'pending',
                'expires_at' => $this->ts($r['expires_at']) ?? now(),
                'created_at' => $this->ts($r['created_at']) ?? now(),
                'updated_at' => $this->ts($r['created_at']) ?? now(),
            ];
        }

        $this->insertChunked('client_invitations', $records);
        $this->resetAutoIncrement('client_invitations', $records);
        $this->command->info("  ✓ {$rows['count']} client invitations imported.");
    }

    // =========================================================================
    // DUMP PARSER — reads pg_dump COPY format
    // =========================================================================

    private function parseDump(string $path): void
    {
        $handle = fopen($path, 'r');
        if (!$handle) {
            $this->command->error("Cannot open dump file.");
            return;
        }

        $currentTable   = null;
        $currentColumns = [];
        $currentRows    = [];
        $inCopy         = false;

        while (($line = fgets($handle)) !== false) {
            $line = rtrim($line, "\r\n");

            if (preg_match('/^COPY (\S+) \(([^)]+)\) FROM stdin;/', $line, $m)) {
                $currentTable   = $m[1];
                $currentColumns = array_map('trim', explode(',', $m[2]));
                $currentRows    = [];
                $inCopy         = true;
                continue;
            }

            if ($inCopy) {
                if ($line === '\\.') {
                    $this->copyBlocks[$currentTable] = [
                        'columns' => $currentColumns,
                        'rows'    => $currentRows,
                    ];
                    $inCopy = false;
                    continue;
                }

                $values = explode("\t", $line);
                $row    = [];
                foreach ($currentColumns as $i => $col) {
                    $val      = $values[$i] ?? null;
                    $row[$col] = $this->unescape($val);
                }
                $currentRows[] = $row;
            }
        }

        fclose($handle);
    }

    private function unescape(?string $val): ?string
    {
        if ($val === null || $val === '\\N') return null;
        return str_replace(['\\\\', '\\n', '\\t', '\\r'], ['\\', "\n", "\t", "\r"], $val);
    }

    private function getRows(string $table): array
    {
        $block = $this->copyBlocks[$table] ?? null;
        if (!$block) {
            $this->command->warn("  No data found for table '{$table}' in dump.");
            return ['count' => 0, 'data' => []];
        }
        return ['count' => count($block['rows']), 'data' => $block['rows']];
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private function bool(?string $val): int
    {
        return ($val === 't' || $val === '1' || $val === 'true') ? 1 : 0;
    }

    private function ts(?string $val): ?string
    {
        if ($val === null) return null;
        try {
            return date('Y-m-d H:i:s', strtotime($val)) ?: null;
        } catch (\Exception $e) {
            return null;
        }
    }

    private function insertChunked(string $table, array $records, int $chunkSize = 100): void
    {
        foreach (array_chunk($records, $chunkSize) as $chunk) {
            DB::table($table)->insertOrIgnore($chunk);
        }
    }

    private function resetAutoIncrement(string $table, array $records): void
    {
        if (empty($records)) return;
        $maxId = max(array_map(fn($r) => (int) ($r['id'] ?? 0), $records));
        if ($maxId > 0) {
            DB::statement("ALTER TABLE `{$table}` AUTO_INCREMENT = " . ($maxId + 1));
        }
    }
}
