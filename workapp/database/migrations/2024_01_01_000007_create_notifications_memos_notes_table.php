<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->string('type');
            $table->text('content')->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->string('reference_type')->nullable();
            $table->boolean('read')->default(false);
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('memos', function (Blueprint $table) {
            $table->id();
            $table->string('subject');
            $table->text('content');
            $table->json('recipients');
            $table->unsignedBigInteger('sender_id');
            $table->timestamps();
            $table->foreign('sender_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('memo_reads', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('memo_id');
            $table->unsignedBigInteger('user_id');
            $table->timestamp('read_at')->useCurrent();
            $table->foreign('memo_id')->references('id')->on('memos')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('memo_responses', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('memo_id');
            $table->unsignedBigInteger('user_id');
            $table->text('content');
            $table->timestamps();
            $table->foreign('memo_id')->references('id')->on('memos')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('notes', function (Blueprint $table) {
            $table->id();
            $table->string('title')->nullable();
            $table->text('content')->nullable();
            $table->json('todo_items')->nullable();
            $table->string('color')->nullable();
            $table->unsignedBigInteger('user_id');
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notes');
        Schema::dropIfExists('memo_responses');
        Schema::dropIfExists('memo_reads');
        Schema::dropIfExists('memos');
        Schema::dropIfExists('notifications');
    }
};
