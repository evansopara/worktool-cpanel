<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Mark all pre-existing migrations as done so `migrate:status` is clean
        $existing = [
            '0001_01_01_000001_create_cache_table',
            '0001_01_01_000002_create_jobs_table',
            '2024_01_01_000001_create_users_table',
            '2024_01_01_000002_create_projects_table',
            '2024_01_01_000003_create_tasks_table',
            '2024_01_01_000004_create_project_members_table',
            '2024_01_01_000005_create_task_sessions_table',
            '2024_01_01_000006_create_plans_and_messages_table',
            '2024_01_01_000007_create_notifications_memos_notes_table',
            '2024_01_01_000008_create_leave_bookings_resources_table',
            '2024_01_01_000009_create_support_and_misc_tables',
            '2026_04_01_041734_create_personal_access_tokens_table',
            '2026_04_01_100000_update_projects_and_tasks_schema',
            '2026_04_01_200000_add_legacy_columns_to_users_table',
            '2026_04_29_225101_add_created_by_to_projects_table',
            '2026_06_10_131023_add_missing_columns_to_tasks_table',
        ];

        foreach ($existing as $migration) {
            DB::table('migrations')->insertOrIgnore([
                'migration' => $migration,
                'batch' => 1,
            ]);
        }

        // Add missing columns to task_sessions
        Schema::table('task_sessions', function (Blueprint $table) {
            if (!Schema::hasColumn('task_sessions', 'ended_at')) {
                $table->timestamp('ended_at')->nullable();
            }
            if (!Schema::hasColumn('task_sessions', 'duration_seconds')) {
                $table->integer('duration_seconds')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('task_sessions', function (Blueprint $table) {
            $table->dropColumn(['ended_at', 'duration_seconds']);
        });
    }
};
