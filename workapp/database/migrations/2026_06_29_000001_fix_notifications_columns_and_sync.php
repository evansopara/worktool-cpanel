<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Mark the previously missed migration as done
        DB::table('migrations')->insertOrIgnore([
            'migration' => '2026_06_22_100000_add_title_message_to_notifications_table',
            'batch' => 2,
        ]);

        Schema::table('notifications', function (Blueprint $table) {
            if (!Schema::hasColumn('notifications', 'title')) {
                $table->string('title')->nullable()->after('type');
            }
            if (Schema::hasColumn('notifications', 'content') && !Schema::hasColumn('notifications', 'message')) {
                $table->renameColumn('content', 'message');
            }
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (Schema::hasColumn('notifications', 'message') && !Schema::hasColumn('notifications', 'content')) {
                $table->renameColumn('message', 'content');
            }
            if (Schema::hasColumn('notifications', 'title')) {
                $table->dropColumn('title');
            }
        });
    }
};
