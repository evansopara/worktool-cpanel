<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::dropIfExists('users');
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('username')->unique();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('email')->nullable();
            $table->string('password');
            $table->string('role')->default('staff'); // operations_manager|team_lead|project_manager|staff|intern|customer_support_officer|client
            $table->string('specialization')->nullable();
            $table->string('department')->nullable();
            $table->string('phone')->nullable();
            $table->string('profile_picture')->nullable();
            $table->string('status')->default('pending'); // active|inactive|pending
            $table->string('work_status')->default('available'); // available|busy|on_leave|offline
            $table->boolean('must_set_password')->default(false);
            $table->string('password_setup_token')->nullable();
            $table->unsignedBigInteger('current_task_id')->nullable();
            $table->timestamp('last_active')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->rememberToken();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
