<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Status vocabulary simplified from open/in_review/resolved/closed to
        // pending/reviewed/resolved to match the management console's 3 tabs.
        DB::table('staff_complaints')->where('status', 'open')->update(['status' => 'pending']);
        DB::table('staff_complaints')->where('status', 'in_review')->update(['status' => 'reviewed']);
        DB::table('staff_complaints')->where('status', 'closed')->update(['status' => 'resolved']);

        // doctrine/dbal isn't installed, so ->change() can't be used — raw SQL instead.
        DB::statement("ALTER TABLE staff_complaints MODIFY status VARCHAR(255) NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE staff_complaints MODIFY status VARCHAR(255) NOT NULL DEFAULT 'open'");
        DB::table('staff_complaints')->where('status', 'pending')->update(['status' => 'open']);
        DB::table('staff_complaints')->where('status', 'reviewed')->update(['status' => 'in_review']);
    }
};
