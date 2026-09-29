<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Account active flag from old system
            $table->boolean('is_active')->default(true)->after('work_status');

            // Last seen timestamp (when user was last online)
            $table->timestamp('last_seen')->nullable()->after('is_active');

            // Break/work-session tracking
            $table->integer('break_count')->default(0)->after('last_seen');
            $table->timestamp('break_start_time')->nullable()->after('break_count');
            $table->string('break_one_time')->nullable()->after('break_start_time');  // stores time string e.g. "14:00"
            $table->timestamp('task_start_time')->nullable()->after('break_one_time');

            // Absence tracking
            $table->string('absence_reason')->nullable()->after('task_start_time');
            $table->string('absence_end_date')->nullable()->after('absence_reason');

            // Onboarding & client classification
            $table->string('onboarding_status')->nullable()->after('absence_end_date');
            $table->string('product_service')->nullable()->after('onboarding_status');
            $table->string('client_type')->nullable()->after('product_service');
            $table->string('gender')->nullable()->after('client_type');
            $table->string('project_manager_type')->nullable()->after('gender');

            // Auth tokens from old system
            $table->string('verification_token')->nullable();
            $table->string('reset_password_token')->nullable();
            $table->timestamp('reset_password_expires')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'is_active',
                'last_seen',
                'break_count',
                'break_start_time',
                'break_one_time',
                'task_start_time',
                'absence_reason',
                'absence_end_date',
                'onboarding_status',
                'product_service',
                'client_type',
                'gender',
                'project_manager_type',
                'verification_token',
                'reset_password_token',
                'reset_password_expires',
            ]);
        });
    }
};
