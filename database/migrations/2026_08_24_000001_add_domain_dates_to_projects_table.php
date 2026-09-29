<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->date('domain_registered_at')->nullable()->after('end_date');
            $table->date('domain_expires_at')->nullable()->after('domain_registered_at');
            $table->timestamp('domain_expiry_notified_at')->nullable()->after('domain_expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn(['domain_registered_at', 'domain_expires_at', 'domain_expiry_notified_at']);
        });
    }
};
