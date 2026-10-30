<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pinning in direct and project chats (the general channel already has
 * is_pinned). Guarded: the live database is built from an SQL import and
 * may already have the column (see newtest/database/2026-10-30-pin-messages.sql).
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['direct_messages', 'project_messages'] as $table) {
            if (!Schema::hasColumn($table, 'is_pinned')) {
                Schema::table($table, fn (Blueprint $t) => $t->boolean('is_pinned')->default(false));
            }
        }
    }

    public function down(): void
    {
        foreach (['direct_messages', 'project_messages'] as $table) {
            if (Schema::hasColumn($table, 'is_pinned')) {
                Schema::table($table, fn (Blueprint $t) => $t->dropColumn('is_pinned'));
            }
        }
    }
};
