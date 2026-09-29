<?php

namespace App\Console\Commands;

use App\Models\Project;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class CheckDomainExpiry extends Command
{
    protected $signature = 'domains:check-expiry';
    protected $description = 'Notify project managers when a project domain is nearing its expiry date';

    /**
     * Notify once a domain falls within this many days of expiry (or is already expired).
     */
    private const WARNING_DAYS = 30;

    public function handle()
    {
        $projects = Project::whereNotNull('domain_expires_at')
            ->whereNotNull('manager_id')
            ->whereNull('domain_expiry_notified_at')
            ->where('domain_expires_at', '<=', now()->addDays(self::WARNING_DAYS)->toDateString())
            ->get();

        foreach ($projects as $project) {
            $expiresAt = $project->domain_expires_at->toDateString();
            $isExpired = $project->domain_expires_at->isPast();
            $message = $isExpired
                ? "The domain for project \"{$project->name}\" expired on {$expiresAt}."
                : "The domain for project \"{$project->name}\" expires on {$expiresAt}.";

            NotificationService::send(
                $project->manager_id,
                'domain_expiring',
                $isExpired ? 'Domain Expired' : 'Domain Expiring Soon',
                $message,
                $project->id,
                'project',
            );

            $project->update(['domain_expiry_notified_at' => now()]);
        }

        $this->info("Notified for {$projects->count()} project domain(s).");
        return 0;
    }
}
