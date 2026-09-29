<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('issue_reports', function (Blueprint $table) {
            $table->string('category')->nullable()->after('description');
            $table->text('suggestions')->nullable()->after('description');
        });

        // Status vocabulary changed from open/in_progress to pending/reviewing
        // (resolved/closed are unchanged) to match the management console's tabs.
        DB::table('issue_reports')->where('status', 'open')->update(['status' => 'pending']);
        DB::table('issue_reports')->where('status', 'in_progress')->update(['status' => 'reviewing']);

        // doctrine/dbal isn't installed, so ->change() can't be used — raw SQL instead.
        DB::statement("ALTER TABLE issue_reports MODIFY status VARCHAR(255) NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE issue_reports MODIFY status VARCHAR(255) NOT NULL DEFAULT 'open'");
        DB::table('issue_reports')->where('status', 'pending')->update(['status' => 'open']);
        DB::table('issue_reports')->where('status', 'reviewing')->update(['status' => 'in_progress']);

        Schema::table('issue_reports', function (Blueprint $table) {
            $table->dropColumn(['category', 'suggestions']);
        });
    }
};
