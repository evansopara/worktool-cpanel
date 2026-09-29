<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('tasks', 'timer_stopped_at')) {
                $table->timestamp('timer_stopped_at')->nullable();
            }
            if (!Schema::hasColumn('tasks', 'submitted_at')) {
                $table->timestamp('submitted_at')->nullable();
            }
            if (!Schema::hasColumn('tasks', 'submitted_by')) {
                $table->unsignedBigInteger('submitted_by')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn(['timer_stopped_at', 'submitted_at', 'submitted_by']);
        });
    }
};
