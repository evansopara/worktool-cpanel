<?php

namespace App\Support;

use App\Models\Deliverable;
use App\Models\Resource;
use App\Models\User;

/**
 * Where a notification takes its reader: the in-app list, the push
 * notification and the email all open the page the notification is about.
 * Paths are relative to the site root.
 */
class NotificationLinks
{
    public static function for(User $user, string $type, ?string $referenceType, ?int $referenceId): string
    {
        $reviewer = in_array($user->role, ['operations_manager', 'team_lead'], true);
        $techSupport = $user->role === 'staff' && $user->specialization === 'technical_support';

        switch ($referenceType) {
            case 'task':
                // Estimate requests are decided on the task, like extensions.
                return $referenceId ? "/dashboard/tasks?task={$referenceId}" : '/dashboard/tasks';
            case 'deadline_extension_request':
            case 'estimate_request':
                return '/dashboard/tasks?view=ext';
            case 'project':
                return $referenceId ? "/dashboard/projects?id={$referenceId}" : '/dashboard/projects';
            case 'resource':
                return self::project(Resource::find($referenceId)?->project_id);
            case 'deliverable':
                return self::project(Deliverable::with('plan')->find($referenceId)?->plan?->project_id);
            case 'leave_application':
                return $reviewer ? '/dashboard/people' : '/dashboard/leave';
            case 'staff_complaint':
                return $reviewer ? '/dashboard/people?tab=complaints' : '/dashboard/staff-complaints';
            case 'staff_query':
                return $reviewer ? '/dashboard/people?tab=queries' : '/dashboard/queries';
            case 'complaint':
            case 'client_sentiment':
                return $reviewer ? '/dashboard/clients' : '/dashboard';
            case 'review_link':
                return '/dashboard/review-links';
            case 'memo':
                return '/dashboard/messages?tab=memos';
            case 'booking':
                return '/dashboard/bookings';
            case 'technical_support_request':
                return '/dashboard/support';
            case 'issue_report':
                return $techSupport ? '/dashboard/issues' : '/dashboard/settings#report';
        }

        return '/dashboard/notifications';
    }

    private static function project(?int $projectId): string
    {
        return $projectId ? "/dashboard/projects?id={$projectId}" : '/dashboard/projects';
    }
}
