<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_sentiment', function (Blueprint $table) {
            $table->boolean('is_flagged')->default(false)->after('sentiment');
        });

        // Clients now self-report a general weekly check-in (no project attached),
        // so project_id can no longer be required. doctrine/dbal isn't installed,
        // so ->change() can't be used — raw SQL instead. The existing FK constraint
        // is unaffected; MySQL FKs simply don't apply to NULL values.
        DB::statement('ALTER TABLE client_sentiment MODIFY project_id BIGINT UNSIGNED NULL');

        // Sentiment vocabulary simplified from positive/neutral/negative to satisfied/dissatisfied.
        DB::table('client_sentiment')->where('sentiment', 'positive')->update(['sentiment' => 'satisfied']);
        DB::table('client_sentiment')->whereIn('sentiment', ['negative', 'neutral'])->update(['sentiment' => 'dissatisfied']);
    }

    public function down(): void
    {
        DB::table('client_sentiment')->where('sentiment', 'satisfied')->update(['sentiment' => 'positive']);
        DB::table('client_sentiment')->where('sentiment', 'dissatisfied')->update(['sentiment' => 'negative']);

        DB::statement('ALTER TABLE client_sentiment MODIFY project_id BIGINT UNSIGNED NOT NULL');

        Schema::table('client_sentiment', function (Blueprint $table) {
            $table->dropColumn('is_flagged');
        });
    }
};
