<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // requested_deadline / approved_deadline were DATE-only, dropping the time
        // the requester/approver picked. Widen to DATETIME via raw SQL (avoids
        // requiring doctrine/dbal for a Blueprint::change()).
        DB::statement('ALTER TABLE deadline_extension_requests MODIFY requested_deadline DATETIME NULL');
        DB::statement('ALTER TABLE deadline_extension_requests MODIFY approved_deadline DATETIME NULL');

        Schema::table('deadline_extension_requests', function (Blueprint $table) {
            if (!Schema::hasColumn('deadline_extension_requests', 'approved_working_hours')) {
                $table->integer('approved_working_hours')->nullable()->after('approved_deadline');
            }
            if (!Schema::hasColumn('deadline_extension_requests', 'approved_working_minutes')) {
                $table->integer('approved_working_minutes')->nullable()->after('approved_working_hours');
            }
        });
    }

    public function down(): void
    {
        Schema::table('deadline_extension_requests', function (Blueprint $table) {
            $table->dropColumn(['approved_working_hours', 'approved_working_minutes']);
        });
        DB::statement('ALTER TABLE deadline_extension_requests MODIFY requested_deadline DATE NULL');
        DB::statement('ALTER TABLE deadline_extension_requests MODIFY approved_deadline DATE NULL');
    }
};
