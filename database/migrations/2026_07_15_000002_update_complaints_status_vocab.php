<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Status vocabulary simplified from open/in_review/resolved/closed to
        // pending/reviewed/resolved, matching the Staff Complaints console.
        DB::table('complaints')->where('status', 'open')->update(['status' => 'pending']);
        DB::table('complaints')->where('status', 'in_review')->update(['status' => 'reviewed']);
        DB::table('complaints')->where('status', 'closed')->update(['status' => 'resolved']);

        // doctrine/dbal isn't installed, so ->change() can't be used — raw SQL instead.
        DB::statement("ALTER TABLE complaints MODIFY status VARCHAR(255) NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE complaints MODIFY status VARCHAR(255) NOT NULL DEFAULT 'open'");
        DB::table('complaints')->where('status', 'pending')->update(['status' => 'open']);
        DB::table('complaints')->where('status', 'reviewed')->update(['status' => 'in_review']);
    }
};
