<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Complaint;
use App\Models\DeadlineExtensionRequest;
use App\Models\LeaveApplication;
use App\Models\Project;
use App\Models\StaffComplaint;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * GET /home — everything the Home page shows (Main / StaffHome artboards,
 * design/HANDOFF_SPEC.md §6), counted on the server with the same rules the
 * old dashboard used in the browser.
 */
class HomeController extends Controller
{
    private const CATEGORIES = [
        'website_development' => 'Website Development',
        'dpl_outright' => 'DPL Outright',
        'dpl_partnership' => 'DPL Partnership',
        'direct_marketing' => 'Direct Marketing',
        'support_maintenance' => 'Support & Maintenance',
    ];

    public function index(Request $request)
    {
        $user = $request->user();
        $tasks = Task::query();
        if (!$user->isManager()) {
            $tasks->where('assignee_id', $user->id);
        }

        $counts = (clone $tasks)->selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status');
        $data = [
            'status_counts' => [
                'in_progress' => (int) ($counts['in_progress'] ?? 0),
                'pending' => (int) ($counts['pending'] ?? 0),
                'todo' => (int) ($counts['todo'] ?? 0),
                'review' => (int) ($counts['review'] ?? 0),
                'technical_support' => (int) ($counts['technical_support'] ?? 0),
                'deadline_missed' => (int) ($counts['deadline_missed'] ?? 0),
            ],
        ];

        if ($user->isManager()) {
            $data['needs'] = $this->needs($user);
            $data['pipeline'] = $this->pipeline($user);
        } else {
            $data['current'] = $this->currentTask($user);
            $data['extension'] = $this->latestExtension($user);
        }

        return response()->json($data);
    }

    /**
     * "Needs you": pending items this manager can act on, each linking to
     * where they act. Who sees what follows the old pages' rules.
     */
    private function needs(User $user): array
    {
        $items = [];
        $reviewer = in_array($user->role, ['operations_manager', 'team_lead'], true);

        $ext = DeadlineExtensionRequest::with(['requester', 'task.project'])->where('status', 'pending');
        if ($user->role === 'project_manager') {
            $ext->where('project_manager_id', $user->id);
        }
        $ext = $ext->latest()->get()->filter(fn ($r) => $r->task); // skip deleted tasks
        if ($ext->isNotEmpty()) {
            $first = $ext->first();
            $items[] = [
                'key' => 'extensions',
                'count' => $ext->count(),
                'label' => $ext->count() === 1 ? 'Deadline extension to decide' : 'Deadline extensions to decide',
                'detail' => trim(($first->requester?->fullName() ?? '') . ' · ' . ($first->task->project->name ?? ''), ' ·'),
                'href' => '/dashboard/tasks?view=ext',
            ];
        }

        if ($reviewer) {
            $leave = LeaveApplication::with('user')->where('status', 'pending')->latest()->get();
            if ($leave->isNotEmpty()) {
                $items[] = [
                    'key' => 'leave',
                    'count' => $leave->count(),
                    'label' => $leave->count() === 1 ? 'Leave application pending' : 'Leave applications pending',
                    'detail' => $this->names($leave->map(fn ($l) => $l->user?->fullName())),
                    'href' => '/dashboard/people?tab=leave',
                ];
            }

            $complaints = Complaint::where('status', 'pending')->orderBy('id')->pluck('id');
            if ($complaints->isNotEmpty()) {
                $items[] = [
                    'key' => 'client_complaints',
                    'count' => $complaints->count(),
                    'label' => $complaints->count() === 1 ? 'Client complaint pending' : 'Client complaints pending',
                    'detail' => $this->numbers($complaints),
                    'href' => '/dashboard/clients',
                ];
            }

            $staff = StaffComplaint::where('status', 'pending')->orderBy('id')->pluck('id');
            if ($staff->isNotEmpty()) {
                $items[] = [
                    'key' => 'staff_complaints',
                    'count' => $staff->count(),
                    'label' => $staff->count() === 1 ? 'Staff complaint pending' : 'Staff complaints pending',
                    'detail' => $this->numbers($staff),
                    'href' => '/dashboard/people?tab=complaints',
                ];
            }
        }

        return $items;
    }

    /**
     * Project pipeline, as the old dashboard grouped it: active = a task in
     * progress or a timer running; completed = 100% progress; pending = the
     * rest with no tasks or no task touched for a week.
     */
    private function pipeline(User $user): array
    {
        $projects = Project::visibleTo($user)->orderByDesc('created_at')->get(['id', 'name', 'category', 'progress']);
        $tasks = Task::whereIn('project_id', $projects->pluck('id'))
            ->get(['id', 'project_id', 'status', 'is_timer_running', 'updated_at'])
            ->groupBy('project_id');
        $weekAgo = now()->subDays(7);

        $active = $completed = $pending = [];
        foreach ($projects as $p) {
            $pt = $tasks->get($p->id, collect());
            $item = ['id' => $p->id, 'name' => $p->name, 'category' => self::CATEGORIES[$p->category] ?? ucfirst(str_replace('_', ' ', (string) $p->category))];

            if ($pt->contains(fn ($t) => $t->status === 'in_progress' || $t->is_timer_running)) {
                $active[] = $item + ['flag' => $pt->contains('is_timer_running', true) ? 'Task timer running' : null];
            } elseif ((int) $p->progress === 100) {
                $completed[] = $item;
            } elseif ($pt->isEmpty()) {
                $pending[] = $item + ['flag' => 'No tasks assigned'];
            } elseif ($pt->every(fn ($t) => $t->updated_at && $t->updated_at->lt($weekAgo))) {
                $pending[] = $item + ['flag' => 'No work activity for 1+ week'];
            }
        }

        $group = fn (array $items, int $show) => ['total' => count($items), 'items' => array_slice($items, 0, $show)];
        return [
            'active' => $group($active, 4),
            'pending' => $group($pending, 3),
            'completed' => $group($completed, 4),
        ];
    }

    /** Staff: the task with the timer running, else the next one due to start. */
    private function currentTask(User $user): ?array
    {
        $base = Task::with(['project', 'assignee', 'assigner'])
            ->withCount(['extensionRequests as pending_extensions_count' => fn ($q) => $q->where('status', 'pending')])
            ->where('assignee_id', $user->id);

        // Running first; then work already in progress; then the next
        // scheduled task; tasks whose deadline has passed come last.
        $task = (clone $base)->where('is_timer_running', true)->first()
            ?? (clone $base)->whereNotIn('status', ['completed', 'review'])
                ->orderByRaw("CASE WHEN status IN ('in_progress', 'on_hold') THEN 0 WHEN status = 'deadline_missed' THEN 2 ELSE 1 END")
                ->orderByRaw('start_date IS NULL')->orderBy('start_date')->orderBy('deadline')->first();

        if (!$task) {
            return null;
        }
        $task->markDeadlineMissed();
        return $task->toListItem();
    }

    /** Staff: their most recent extension request and where it stands. */
    private function latestExtension(User $user): ?array
    {
        $r = DeadlineExtensionRequest::with('task')->where('requester_id', $user->id)->latest()->first();
        if (!$r || !$r->task) {
            return null;
        }
        return [
            'id' => $r->id,
            'task_title' => $r->task->title,
            // While pending, the task still has the deadline it asks to move.
            'from' => $r->status === 'pending' ? $r->task->deadline?->toIso8601String() : null,
            'requested' => $r->requested_deadline?->toIso8601String(),
            'status' => $r->status === 'rejected' ? 'declined' : $r->status,
        ];
    }

    /** "Linda Ekeh, Temitayo Akintunde" or "Linda Ekeh, Temitayo Akintunde and 3 more". */
    private function names(Collection $names): string
    {
        $names = $names->filter()->unique()->values();
        $shown = $names->take(2)->implode(', ');
        return $names->count() > 2 ? "{$shown} and " . ($names->count() - 2) . ' more' : $shown;
    }

    /** "Complaint #7", "Complaints #1 and #2", "Complaints #1, #2 and 3 more". */
    private function numbers(Collection $ids): string
    {
        $tags = $ids->map(fn ($id) => "#{$id}");
        if ($tags->count() === 1) {
            return "Complaint {$tags[0]}";
        }
        if ($tags->count() === 2) {
            return "Complaints {$tags[0]} and {$tags[1]}";
        }
        return "Complaints {$tags[0]}, {$tags[1]} and " . ($tags->count() - 2) . ' more';
    }
}
