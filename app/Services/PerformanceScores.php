<?php

namespace App\Services;

use App\Models\AttendanceCheck;
use App\Models\DeadlineExtensionRequest;
use App\Models\LeaveApplication;
use App\Models\Task;
use App\Models\TaskEvent;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Leaderboard scores (Performance page spec §4), computed on request from
 * tasks, their events and attendance checks for one date range.
 *
 * Staff board (staff, interns): on-time 40 · first-time approval 25 ·
 * estimate accuracy 15 · attendance 20.
 * Project manager board: team on-time 35 · projects on schedule 20 ·
 * decision speed 20 · client rating 15 · estimate quality 10.
 *
 * Every measure is 0–100 before weighting. A measure with no data is left out
 * and the others are re-weighted. Fewer than 5 tasks = not ranked.
 */
class PerformanceScores
{
    public const STAFF_ROLES = ['staff', 'intern'];
    public const PM_ROLES = ['project_manager'];
    public const MIN_TASKS = 5;

    public const WEIGHTS = [
        'staff' => ['on_time' => 40, 'first_time' => 25, 'estimate' => 15, 'attendance' => 20],
        'pm' => ['team_on_time' => 35, 'on_schedule' => 20, 'decision_speed' => 20, 'client_rating' => 15, 'estimate' => 10],
    ];

    /** Decision speed: 100 at this median or faster, 0 at FAST + SPAN hours. */
    private const DECISION_FAST_HOURS = 2;
    private const DECISION_SPAN_HOURS = 46;

    private Carbon $from;
    private Carbon $to;

    public function __construct(Carbon $from, Carbon $to)
    {
        $this->from = $from->copy()->startOfDay();
        $this->to = $to->copy()->endOfDay();
    }

    /** The same-length period just before this one. */
    public function previous(int $steps = 1): self
    {
        $days = $this->from->diffInDays($this->to->copy()->startOfDay()) + 1;
        return new self($this->from->copy()->subDays($days * $steps), $this->to->copy()->subDays($days * $steps));
    }

    public function from(): Carbon { return $this->from; }
    public function to(): Carbon { return $this->to; }

    public static function boardFor(User $user): ?string
    {
        if (in_array($user->role, self::STAFF_ROLES, true)) return 'staff';
        if (in_array($user->role, self::PM_ROLES, true)) return 'pm';
        return null;
    }

    /**
     * Ranked rows, with movement since the previous period of the same length.
     *
     * @return array<int, array<string, mixed>>
     */
    public function board(string $board, bool $withMovement = true): array
    {
        $rows = $this->rank($board === 'pm' ? $this->pmRows() : $this->staffRows());
        if ($withMovement) {
            $before = collect($this->previous()->board($board, false))->keyBy(fn ($r) => $r['user']['id']);
            foreach ($rows as &$row) {
                $prev = $before->get($row['user']['id'])['rank'] ?? null;
                $row['movement'] = $row['rank'] !== null && $prev !== null ? $prev - $row['rank'] : null;
            }
            unset($row);
        }
        return $rows;
    }

    /** One person's row from their board, or null if they aren't on one. */
    public function row(User $user): ?array
    {
        $board = self::boardFor($user);
        if (!$board) return null;
        return collect($this->board($board))->first(fn ($r) => $r['user']['id'] === $user->id);
    }

    /** Ranked boards first by score, unranked after them by score. */
    private function rank(array $rows): array
    {
        usort($rows, fn ($a, $b) => [$b['ranked'], $b['score'] ?? -1, $b['tasks']] <=> [$a['ranked'], $a['score'] ?? -1, $a['tasks']]);
        $rank = 0;
        foreach ($rows as &$row) {
            $row['rank'] = $row['ranked'] ? ++$rank : null;
            $row['movement'] = null;
        }
        return $rows;
    }

    // ── Staff ───────────────────────────────────────────────────────────

    private function staffRows(): array
    {
        $users = User::whereIn('role', self::STAFF_ROLES)->where('is_active', true)->get();
        $tasks = $this->dueTasks(fn ($q) => $q->whereIn('assignee_id', $users->pluck('id')))->groupBy('assignee_id');
        $checks = $this->checks($users->pluck('id'))->groupBy('user_id');

        return $users->map(function (User $u) use ($tasks, $checks) {
            $mine = $tasks->get($u->id, collect());
            $measures = [
                'on_time' => $this->onTime($mine),
                'first_time' => $this->firstTime($mine),
                'estimate' => $this->estimate($mine),
                'attendance' => $this->attendance($checks->get($u->id, collect())),
            ];
            return $this->makeRow($u, 'staff', $measures, $mine->count());
        })->all();
    }

    // ── Project managers ───────────────────────────────────────────────

    private function pmRows(): array
    {
        $users = User::whereIn('role', self::PM_ROLES)->where('is_active', true)->get();
        $projects = DB::table('projects')->whereIn('manager_id', $users->pluck('id'))->get();
        $projectManager = $projects->pluck('manager_id', 'id');
        $tasks = $this->dueTasks(fn ($q) => $q->whereIn('project_id', $projects->pluck('id')))
            ->groupBy(fn (Task $t) => $projectManager[$t->project_id] ?? 0);

        return $users->map(function (User $u) use ($tasks, $projects) {
            $team = $tasks->get($u->id, collect());
            $mine = $projects->where('manager_id', $u->id);
            $measures = [
                'team_on_time' => $this->onTime($team),
                'on_schedule' => $this->onSchedule($mine),
                'decision_speed' => $this->decisionSpeed($u),
                'client_rating' => $this->clientRating($mine->pluck('id')),
                'estimate' => $this->estimate($team),
            ];
            return $this->makeRow($u, 'pm', $measures, $team->count());
        })->all();
    }

    private function makeRow(User $u, string $board, array $measures, int $taskCount): array
    {
        $weighted = 0;
        $weights = 0;
        foreach (self::WEIGHTS[$board] as $key => $weight) {
            $measures[$key]['weight'] = $weight;
            if (($measures[$key]['score'] ?? null) !== null) {
                $weighted += $measures[$key]['score'] * $weight;
                $weights += $weight;
            }
        }
        return [
            'user' => ['id' => $u->id, 'name' => $u->fullName(), 'role' => $u->role],
            'score' => $weights > 0 ? (int) round($weighted / $weights) : null,
            'ranked' => $taskCount >= self::MIN_TASKS,
            'tasks' => $taskCount,
            'measures' => $measures,
        ];
    }

    // ── Measures ────────────────────────────────────────────────────────

    /**
     * Tasks whose final deadline falls in the range and has passed, or that
     * were submitted already. Deadlines on the assignee's approved leave days
     * don't count.
     */
    public function dueTasks(callable $scope): Collection
    {
        $now = now();
        $query = Task::query()
            ->whereNotNull('deadline')
            ->whereBetween('deadline', [$this->from, $this->to])
            ->where(fn ($q) => $q->where('deadline', '<=', $now)->orWhereIn('status', ['review', 'completed', 'not_approved']))
            ->with(['events' => fn ($q) => $q->whereIn('type', [TaskEvent::SUBMITTED, TaskEvent::APPROVED, TaskEvent::SENT_BACK, TaskEvent::DEADLINE_MISSED])->orderBy('created_at')]);
        $scope($query);
        $tasks = $query->get();

        $leave = LeaveApplication::where('status', 'approved')
            ->whereIn('user_id', $tasks->pluck('assignee_id')->filter()->unique())
            ->whereDate('start_date', '<=', $this->to->toDateString())
            ->whereDate('end_date', '>=', $this->from->toDateString())
            ->get()
            ->groupBy('user_id');

        return $tasks->reject(function (Task $t) use ($leave) {
            $day = $t->deadline->toDateString();
            return $leave->get($t->assignee_id, collect())->contains(
                fn ($l) => Carbon::parse($l->start_date)->toDateString() <= $day && Carbon::parse($l->end_date)->toDateString() >= $day,
            );
        })->values();
    }

    /** When the task was first sent for review, or null if never. */
    public static function firstSubmittedAt(Task $task): ?Carbon
    {
        $event = $task->events->firstWhere('type', TaskEvent::SUBMITTED);
        return $event?->created_at ?? $task->submitted_at ?? $task->completed_at;
    }

    public static function wasOnTime(Task $task): bool
    {
        $at = self::firstSubmittedAt($task);
        return $at !== null && $at->lte($task->deadline);
    }

    private function onTime(Collection $tasks): array
    {
        $total = $tasks->count();
        $ok = $tasks->filter(fn (Task $t) => self::wasOnTime($t))->count();
        $pct = $total ? (int) round($ok / $total * 100) : null;
        return ['value' => $pct, 'score' => $pct, 'ok' => $ok, 'total' => $total];
    }

    private static function wasSentBack(Task $task): bool
    {
        return $task->events->contains('type', TaskEvent::SENT_BACK) || $task->status === 'not_approved';
    }

    private function firstTime(Collection $tasks): array
    {
        $reviewed = $tasks->filter(fn (Task $t) => $t->status === 'completed' || self::wasSentBack($t)
            || $t->events->contains('type', TaskEvent::APPROVED));
        $total = $reviewed->count();
        $sentBack = $reviewed->filter(fn (Task $t) => self::wasSentBack($t))->count();
        $pct = $total ? (int) round(($total - $sentBack) / $total * 100) : null;
        return ['value' => $pct, 'score' => $pct, 'sent_back' => $sentBack, 'total' => $total];
    }

    /** Logged time as a share of the estimate; the score falls either side of 100%. */
    private function estimate(Collection $tasks): array
    {
        $withEstimate = $tasks->filter(fn (Task $t) => $t->estimateMinutes() > 0 && self::firstSubmittedAt($t) !== null);
        $estimate = $withEstimate->sum(fn (Task $t) => $t->estimateMinutes() * 60);
        if ($estimate <= 0) {
            return ['value' => null, 'score' => null];
        }
        $ratio = (int) round($withEstimate->sum(fn (Task $t) => $t->loggedSeconds()) / $estimate * 100);
        return ['value' => $ratio, 'score' => max(0, 100 - abs($ratio - 100))];
    }

    public function checks(Collection $userIds): Collection
    {
        if (!Schema::hasTable('attendance_checks')) {
            return collect();
        }
        return AttendanceCheck::whereIn('user_id', $userIds)
            ->whereBetween('date', [$this->from->toDateString(), $this->to->toDateString()])
            ->get();
    }

    /** Answered on time / checks that counted (late and missed count against). */
    private function attendance(Collection $checks): array
    {
        $counted = $checks->whereIn('status', [AttendanceCheck::ANSWERED, AttendanceCheck::LATE, AttendanceCheck::MISSED]);
        $total = $counted->count();
        $ok = $counted->where('status', AttendanceCheck::ANSWERED)->count();
        $pct = $total ? (int) round($ok / $total * 100) : null;
        return [
            'value' => $pct,
            'score' => $pct,
            'late' => $counted->where('status', AttendanceCheck::LATE)->count(),
            'missed' => $counted->where('status', AttendanceCheck::MISSED)->count(),
            'total' => $total,
        ];
    }

    /** Active projects with an end date: on schedule if done or not yet due. */
    private function onSchedule(Collection $projects): array
    {
        $cutoff = min($this->to->timestamp, now()->timestamp);
        $dated = $projects->filter(fn ($p) => ($p->status ?? 'active') !== 'inactive' && !empty($p->end_date)
            && Carbon::parse($p->start_date ?? $p->end_date)->lte($this->to));
        $total = $dated->count();
        $ok = $dated->filter(fn ($p) => (int) ($p->progress ?? 0) >= 100
            || Carbon::parse($p->end_date)->endOfDay()->timestamp >= $cutoff)->count();
        $pct = $total ? (int) round($ok / $total * 100) : null;
        return ['value' => $pct, 'score' => $pct, 'ok' => $ok, 'total' => $total];
    }

    /**
     * Median hours from a submit to this manager's approve / send back, and
     * from an extension request to their decision.
     */
    private function decisionSpeed(User $pm): array
    {
        $hours = [];
        $decisions = TaskEvent::whereIn('type', [TaskEvent::APPROVED, TaskEvent::SENT_BACK])
            ->where('actor_id', $pm->id)
            ->whereBetween('created_at', [$this->from, $this->to])
            ->get();
        if ($decisions->isNotEmpty()) {
            $submits = TaskEvent::where('type', TaskEvent::SUBMITTED)
                ->whereIn('task_id', $decisions->pluck('task_id')->unique())
                ->orderBy('created_at')
                ->get()
                ->groupBy('task_id');
            foreach ($decisions as $d) {
                $submit = $submits->get($d->task_id, collect())->filter(fn ($s) => $s->created_at->lte($d->created_at))->last();
                if ($submit) {
                    $hours[] = $submit->created_at->diffInSeconds($d->created_at) / 3600;
                }
            }
        }
        foreach (DeadlineExtensionRequest::where('decided_by', $pm->id)->whereBetween('decided_at', [$this->from, $this->to])->get() as $r) {
            if ($r->created_at && $r->decided_at) {
                $hours[] = $r->created_at->diffInSeconds($r->decided_at) / 3600;
            }
        }
        if (!$hours) {
            return ['value' => null, 'score' => null];
        }
        sort($hours);
        $n = count($hours);
        $median = $n % 2 ? $hours[intdiv($n, 2)] : ($hours[$n / 2 - 1] + $hours[$n / 2]) / 2;
        $score = (int) round(max(0, min(100, 100 - ($median - self::DECISION_FAST_HOURS) / self::DECISION_SPAN_HOURS * 100)));
        return ['value' => round($median, 1), 'score' => $score, 'total' => $n];
    }

    /** Share of client sentiment records in the range that are satisfied. */
    private function clientRating(Collection $projectIds): array
    {
        if ($projectIds->isEmpty() || !Schema::hasTable('client_sentiment')) {
            return ['value' => null, 'score' => null];
        }
        $rows = DB::table('client_sentiment')
            ->whereIn('project_id', $projectIds)
            ->whereBetween(DB::raw('COALESCE(recorded_at, created_at)'), [$this->from, $this->to])
            ->pluck('sentiment');
        $total = $rows->count();
        if (!$total) {
            return ['value' => null, 'score' => null];
        }
        $pct = (int) round($rows->filter(fn ($s) => in_array($s, ['satisfied', 'positive'], true))->count() / $total * 100);
        return ['value' => $pct, 'score' => $pct, 'total' => $total];
    }

    /** Working days (Mon–Fri) in the range, as Y-m-d strings. */
    public function workingDays(): array
    {
        $days = [];
        foreach (CarbonPeriod::create($this->from->copy()->startOfDay(), $this->to->copy()->startOfDay()) as $d) {
            if ($d->isWeekday()) {
                $days[] = $d->toDateString();
            }
        }
        return $days;
    }
}
