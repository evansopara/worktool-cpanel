<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            // Endpoints can exceed 255 chars, and MySQL can't uniquely index a
            // text column, so uniqueness is enforced on a sha256 of it instead.
            $table->text('endpoint');
            $table->char('endpoint_hash', 64)->unique();
            $table->string('public_key');
            $table->string('auth_token');
            $table->string('content_encoding')->default('aes128gcm');
            $table->string('user_agent')->nullable();
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
