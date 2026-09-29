<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// task_sessions was supposed to get `started_at` from
// 2024_01_01_000003_create_tasks_table, but on at least one environment the
// table exists without it (that migration got marked as already-run by
// 2026_06_22_000001_fix_task_sessions_and_sync_migrations without actually
// having created the column there). Add it defensively and backfill from
// created_at, which is the closest available approximation for old rows.
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('task_sessions', 'started_at')) {
            Schema::table('task_sessions', function (Blueprint $table) {
                $table->timestamp('started_at')->nullable()->after('user_id');
            });

            DB::table('task_sessions')
                ->whereNull('started_at')
                ->update(['started_at' => DB::raw('created_at')]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('task_sessions', 'started_at')) {
            Schema::table('task_sessions', function (Blueprint $table) {
                $table->dropColumn('started_at');
            });
        }
    }
};
