<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('review_links') && Schema::hasColumn('review_links', 'assigned_to')) {
            $driver = DB::getDriverName();
            if ($driver === 'mysql') {
                DB::statement('ALTER TABLE review_links MODIFY assigned_to BIGINT UNSIGNED NULL');
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('review_links') && Schema::hasColumn('review_links', 'assigned_to')) {
            $driver = DB::getDriverName();
            if ($driver === 'mysql') {
                DB::statement('UPDATE review_links SET assigned_to = sent_by WHERE assigned_to IS NULL');
                DB::statement('ALTER TABLE review_links MODIFY assigned_to BIGINT UNSIGNED NOT NULL');
            }
        }
    }
};
