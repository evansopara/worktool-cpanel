<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Daily attendance check (Performance page spec §5, §8): one shared random
 * time per working day, and one row per expected person for that day.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_days', function (Blueprint $table) {
            $table->id();
            $table->date('date')->unique();
            // The shared random time; never returned by the API before it fires.
            $table->dateTime('send_at');
            $table->timestamp('fired_at')->nullable();
            $table->timestamps();
        });

        Schema::create('attendance_checks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->date('date');
            $table->timestamp('notified_at')->nullable();
            $table->timestamp('responded_at')->nullable();
            // pending (waiting), answered, late, missed, skipped (approved leave)
            $table->string('status', 12)->default('pending');
            $table->string('device_session_id', 64)->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'date']);
            $table->index(['date', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_checks');
        Schema::dropIfExists('attendance_days');
    }
};
