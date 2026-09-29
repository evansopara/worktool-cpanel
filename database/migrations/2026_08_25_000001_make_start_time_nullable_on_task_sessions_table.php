<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// On at least one environment, task_sessions carries a leftover `start_time`
// column from an older schema (NOT NULL, no default) alongside the
// `started_at` column the app actually reads/writes. Nothing in the
// codebase references `start_time` on task_sessions, but its NOT NULL
// constraint blocks every insert. Make it nullable rather than dropping it,
// since we don't know why it was left there.
return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasColumn('task_sessions', 'start_time')) {
            Schema::table('task_sessions', function (Blueprint $table) {
                $table->timestamp('start_time')->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        // Not reversed: we don't know the column's original default, and
        // re-adding a NOT NULL constraint would break inserts again.
    }
};
