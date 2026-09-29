<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('technical_support_requests', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description');
            $table->unsignedBigInteger('task_id')->nullable();
            $table->unsignedBigInteger('requester_id');
            $table->unsignedBigInteger('assigned_to_id')->nullable();
            $table->string('status')->default('open');
            $table->string('priority')->default('medium');
            $table->text('resolution')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->foreign('requester_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('assigned_to_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('deadline_extension_requests', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('task_id');
            $table->unsignedBigInteger('requester_id');
            $table->unsignedBigInteger('project_manager_id')->nullable();
            $table->text('reason');
            $table->date('requested_deadline')->nullable();
            $table->string('status')->default('pending');
            $table->text('decision_reason')->nullable();
            $table->unsignedBigInteger('decided_by')->nullable();
            $table->timestamp('decided_at')->nullable();
            $table->date('approved_deadline')->nullable();
            $table->timestamps();
            $table->foreign('task_id')->references('id')->on('tasks')->cascadeOnDelete();
            $table->foreign('requester_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('project_manager_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('complaints', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('product_manager_name')->nullable();
            $table->string('developer_name')->nullable();
            $table->string('technical_manager_name')->nullable();
            $table->json('valuable_things')->nullable();
            $table->text('detailed_explanation');
            $table->string('screenshot_url')->nullable();
            $table->string('status')->default('open');
            $table->text('review_comments')->nullable();
            $table->unsignedBigInteger('submitter_id')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('staff_complaints', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('department')->nullable();
            $table->text('detailed_explanation');
            $table->string('screenshot_url')->nullable();
            $table->string('status')->default('open');
            $table->text('review_comments')->nullable();
            $table->unsignedBigInteger('submitter_id')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->foreign('submitter_id')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('staff_queries', function (Blueprint $table) {
            $table->id();
            $table->string('subject');
            $table->text('message');
            $table->unsignedBigInteger('submitted_by');
            $table->unsignedBigInteger('assigned_to')->nullable();
            $table->string('status')->default('open');
            $table->text('response')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();
            $table->foreign('submitted_by')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('assigned_to')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('client_sentiment', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('project_id');
            $table->unsignedBigInteger('client_id')->nullable();
            $table->string('sentiment');
            $table->text('feedback')->nullable();
            $table->unsignedBigInteger('recorded_by')->nullable();
            $table->timestamp('recorded_at')->nullable();
            $table->timestamps();
            $table->foreign('project_id')->references('id')->on('projects')->cascadeOnDelete();
            $table->foreign('client_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('recorded_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('sops', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('category')->nullable();
            $table->string('status')->default('active');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('sop_segments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sop_id');
            $table->string('title');
            $table->text('content');
            $table->integer('order_index')->default(0);
            $table->timestamps();
            $table->foreign('sop_id')->references('id')->on('sops')->cascadeOnDelete();
        });

        Schema::create('issue_reports', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description');
            $table->unsignedBigInteger('reported_by');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('task_id')->nullable();
            $table->string('priority')->default('medium');
            $table->string('status')->default('open');
            $table->string('screenshot_url')->nullable();
            $table->text('resolution')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->foreign('reported_by')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('project_id')->references('id')->on('projects')->nullOnDelete();
        });

        Schema::create('review_links', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('link_url');
            $table->text('description')->nullable();
            $table->unsignedBigInteger('sent_by');
            $table->unsignedBigInteger('assigned_to')->nullable();
            $table->string('status')->default('pending');
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_comment')->nullable();
            $table->timestamps();
            $table->foreign('sent_by')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('assigned_to')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('project_briefings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('project_id');
            $table->text('content');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->foreign('project_id')->references('id')->on('projects')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('users')->nullOnDelete();
            $table->foreign('updated_by')->references('id')->on('users')->nullOnDelete();
        });

        Schema::create('client_invitations', function (Blueprint $table) {
            $table->id();
            $table->string('email');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('invited_by')->nullable();
            $table->string('token');
            $table->string('status')->default('pending');
            $table->timestamp('expires_at');
            $table->timestamps();
            $table->foreign('project_id')->references('id')->on('projects')->nullOnDelete();
            $table->foreign('invited_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_invitations');
        Schema::dropIfExists('project_briefings');
        Schema::dropIfExists('review_links');
        Schema::dropIfExists('issue_reports');
        Schema::dropIfExists('sop_segments');
        Schema::dropIfExists('sops');
        Schema::dropIfExists('client_sentiment');
        Schema::dropIfExists('staff_queries');
        Schema::dropIfExists('staff_complaints');
        Schema::dropIfExists('complaints');
        Schema::dropIfExists('deadline_extension_requests');
        Schema::dropIfExists('technical_support_requests');
    }
};
