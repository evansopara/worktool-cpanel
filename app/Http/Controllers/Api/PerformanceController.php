<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AttendanceCheck;
use App\Models\AttendanceDay;
use App\Models\DeadlineExtensionRequest;
use App\Models\Task;
use App\Models\TaskEvent;
use App\Models\User;
use App\Services\Attendance;
use App\Services\PerformanceScores;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Performance page (KPIs, leaderboard, attendance). Managers (Operations
 * Manager, Team Lead, Project Manager, Customer Support Officer) see the
 * whole team; staff and interns see their own detail and the public
 * leaderboard only.
 */
class PerformanceController extends Controller
{
    private function requireManager(User $user): void
    {
        abort_unless($user->isManager(), 403, 'Only managers can see this.');
    }

    /** ?from&to, defaulting to this week (Monday to Sunday). */
    private function scores(Request $request): PerformanceScores
    {
        $request->validate(['from' => 'nullable|date', 'to' => 'nullable|date']);
        $from = $request->filled('from') ? Carbon::parse($request->query('from')) : now()->startOfWeek(Carbon::MONDAY);
        $to = $request->filled('to') ? Carbon::parse($request->query('to')) : $from->copy()->endOfWeek(Carbon::SUNDAY);
        if ($to->lt($from)) {
            [$from, $to] = [$to, $from];
        }
        // Keep requests cheap: a year at most.
        if ($from->diffInDays($to) > 366) {
            $from = $to->copy()->subDays(366);
        }
        return new PerformanceScores($from, $to);
    }

    private function range(PerformanceScores $s): array
    {
        return ['from' => $s->from()->toDateString(), 'to' => $s->to()->toDateString()];
    }

    // ── Overview ────────────────────────────────────────────────────────

    public function overview(Request $request)
    {
        $this->requireManager($request->user());
        $s = $this->scores($request);
        $rows = $s->board('staff');

        $ok = collect($rows)->sum(fn ($r) => $r['measures']['on_time']['ok'] ?? 0);
        $total = collect($rows)->sum(fn ($r) => $r['measures']['on_time']['total'] ?? 0);

        return response()->json($this->range($s) + [
            'on_time' => ['pct' => $total ? (int) round($ok / $total * 100) : null, 'ok' => $ok, 'total' => $total],
            'today' => $this->todaySummary(),
            'missed_checks' => AttendanceCheck::where('status', AttendanceCheck::MISSED)
                ->whereBetween('date', [$s->from()->toDateString(), $s->to()->toDateString()])
                ->count(),
            'top' => array_values(array_filter($rows, fn ($r) => $r['rank'] !== null && $r['rank'] <= 3)),
            'people' => $rows,
        ]);
    }

    // ── Leaderboard ─────────────────────────────────────────────────────

    public function leaderboard(Request $request)
    {
        $request->validate(['board' => 'nullable|in:staff,pm']);
        $user = $request->user();
        $s = $this->scores($request);
        $board = $request->query('board', 'staff');
        $rows = $s->board($board);

        $me = null;
        if (PerformanceScores::boardFor($user) === $board) {
            $row = collect($rows)->first(fn ($r) => $r['user']['id'] === $user->id);
            if ($row) {
                $me = $row + ['lift' => $this->biggestLift($row, $board)];
            }
        }

        return response()->json($this->range($s) + [
            'board' => $board,
            'weights' => PerformanceScores::WEIGHTS[$board],
            'min_tasks' => PerformanceScores::MIN_TASKS,
            'rows' => $rows,
            'me' => $me,
            // The strip under "Your position": staff see only their own days.
            'my_attendance' => in_array($user->role, Attendance::CHECKED_ROLES, true) ? $this->personDays($user->id, $s) : null,
        ]);
    }

    /** The measure that would add the most points if it reached 100. */
    private function biggestLift(array $row, string $board): ?string
    {
        $best = null;
        $gain = 0;
        foreach (PerformanceScores::WEIGHTS[$board] as $key => $weight) {
            $score = $row['measures'][$key]['score'] ?? null;
            if ($score !== null && ($g = (100 - $score) * $weight) > $gain) {
                [$best, $gain] = [$key, $g];
            }
        }
        return $best;
    }

    // ── Attendance ──────────────────────────────────────────────────────

    /** Live status of today's check (managers). */
    public function attendanceToday(Request $request)
    {
        $this->requireManager($request->user());
        return response()->json($this->todaySummary(withRows: true));
    }

    private function todaySummary(bool $withRows = false): array
    {
        $now = now();
        $out = ['date' => $now->toDateString(), 'working_day' => Attendance::isWorkingDay($now), 'sent_at' => null];
        $day = Attendance::today($now);
        if (!$day) {
            return $out; // not sent yet: the time stays hidden
        }
        $checks = AttendanceCheck::with('user:id,first_name,last_name,username,role')->where('date', $day->date)->get();
        $answered = $checks->whereIn('status', [AttendanceCheck::ANSWERED, AttendanceCheck::LATE]);
        $out += [
            'sent_at' => $day->send_at->toIso8601String(),
            'answer_by' => $day->send_at->copy()->addMinutes(Attendance::ON_TIME_MINUTES)->toIso8601String(),
            'expected' => $checks->where('status', '!=', AttendanceCheck::SKIPPED)->count(),
            'answered' => $answered->count(),
            'waiting' => $checks->where('status', AttendanceCheck::PENDING)->count(),
            'missed' => $checks->where('status', AttendanceCheck::MISSED)->count(),
            'skipped' => $checks->where('status', AttendanceCheck::SKIPPED)->count(),
        ];
        if ($withRows) {
            $order = [AttendanceCheck::ANSWERED => 0, AttendanceCheck::LATE => 0, AttendanceCheck::PENDING => 1, AttendanceCheck::MISSED => 2, AttendanceCheck::SKIPPED => 3];
            $out['rows'] = $checks
                ->sortBy(fn ($c) => [$order[$c->status] ?? 9, $c->responded_at?->timestamp ?? PHP_INT_MAX, $c->user?->fullName()])
                ->values()
                ->map(fn (AttendanceCheck $c) => [
                    'id' => $c->id,
                    'user' => $this->person($c->user),
                    'status' => $c->status,
                    'responded_at' => $c->responded_at?->toIso8601String(),
                ]);
        }
        return $out;
    }

    /** Week grid and missed checks waiting for review (managers). */
    public function attendance(Request $request)
    {
        $this->requireManager($request->user());
        $s = $this->scores($request);
        $days = AttendanceDay::whereBetween('date', [$s->from()->toDateString(), $s->to()->toDateString()])
            ->whereNotNull('fired_at')
            ->orderBy('date')
            ->get();
        $checks = AttendanceCheck::whereIn('date', $days->pluck('date'))->get()->groupBy('user_id');
        $people = User::whereIn('id', $checks->keys())
            ->orWhere(fn ($q) => $q->whereIn('role', Attendance::CHECKED_ROLES)->where('is_active', true))
            ->get()
            ->sortBy(fn (User $u) => $u->fullName())
            ->values();

        return response()->json($this->range($s) + [
            'days' => $days->map(fn (AttendanceDay $d) => ['date' => $d->date, 'sent_at' => $d->send_at->toIso8601String()]),
            'people' => $people->map(function (User $u) use ($checks) {
                $mine = $checks->get($u->id, collect());
                return [
                    'user' => $this->person($u),
                    'cells' => $mine->mapWithKeys(fn (AttendanceCheck $c) => [$c->date => [
                        'status' => $c->status,
                        'responded_at' => $c->responded_at?->toIso8601String(),
                    ]]),
                    'rate' => $this->rate($mine),
                ];
            }),
        ]);
    }

    private function rate(Collection $checks): ?int
    {
        $counted = $checks->whereIn('status', [AttendanceCheck::ANSWERED, AttendanceCheck::LATE, AttendanceCheck::MISSED]);
        return $counted->count() ? (int) round($counted->where('status', AttendanceCheck::ANSWERED)->count() / $counted->count() * 100) : null;
    }

    /** The signed-in person's check for today, for the in-app prompt. */
    public function myCheck(Request $request)
    {
        $user = $request->user();
        $day = Attendance::today();
        $check = $day ? AttendanceCheck::where('user_id', $user->id)->where('date', $day->date)->first() : null;
        if (!$day || !$check) {
            return response()->json(['check' => null]);
        }
        return response()->json(['check' => [
            'id' => $check->id,
            'status' => $check->status,
            'sent_at' => $day->send_at->toIso8601String(),
            'answer_by' => $day->send_at->copy()->addMinutes(Attendance::ON_TIME_MINUTES)->toIso8601String(),
            'responded_at' => $check->responded_at?->toIso8601String(),
            'server_now' => now()->toIso8601String(),
        ]]);
    }

    /** Staff tap "I'm here". */
    public function respond(Request $request, AttendanceCheck $check)
    {
        $user = $request->user();
        abort_unless($check->user_id === $user->id, 403, 'This check is not yours.');
        abort_unless($check->status === AttendanceCheck::PENDING, 422, 'This check is already closed.');
        $day = AttendanceDay::where('date', $check->date)->whereNotNull('fired_at')->firstOrFail();

        $now = now();
        $status = Attendance::statusFor($day->send_at, $now);
        if ($status === null) {
            $check->update(['status' => AttendanceCheck::MISSED]);
            abort(422, 'The answer window has closed.');
        }
        $check->update([
            'status' => $status,
            'responded_at' => $now,
            'device_session_id' => (string) ($user->currentAccessToken()?->id ?? ''),
        ]);

        return response()->json(['id' => $check->id, 'status' => $status, 'responded_at' => $now->toIso8601String()]);
    }

    // ── Person view ─────────────────────────────────────────────────────

    private function person(?User $u): ?array
    {
        return $u ? ['id' => $u->id, 'name' => $u->fullName(), 'role' => $u->role] : null;
    }

    public function personView(Request $request, User $user)
    {
        $viewer = $request->user();
        abort_unless($viewer->isManager() || $viewer->id === $user->id, 403, 'You can only see your own performance.');
        $s = $this->scores($request);
        $board = PerformanceScores::boardFor($user);

        $row = $board ? collect($s->board($board))->first(fn ($r) => $r['user']['id'] === $user->id) : null;

        // Rank over the last 6 periods of the same length, oldest first.
        $history = [];
        if ($board) {
            for ($i = 5; $i >= 0; $i--) {
                $p = $i === 0 ? $s : $s->previous($i);
                $r = collect($p->board($board, false))->first(fn ($r) => $r['user']['id'] === $user->id);
                $history[] = ['from' => $p->from()->toDateString(), 'to' => $p->to()->toDateString(), 'rank' => $r['rank'] ?? null, 'score' => $r['score'] ?? null];
            }
        }

        return response()->json($this->range($s) + [
            'user' => $this->person($user),
            'board' => $board,
            'row' => $row ? $row + ['lift' => $this->biggestLift($row, $board)] : null,
            'history' => $history,
            'attendance' => in_array($user->role, Attendance::CHECKED_ROLES, true) ? $this->personDays($user->id, $s) : null,
            'missed_deadlines' => $this->missedDeadlines($user, $s),
        ]);
    }

    /** Each fired check day in the range for one person. */
    private function personDays(int $userId, PerformanceScores $s): array
    {
        $days = AttendanceDay::whereBetween('date', [$s->from()->toDateString(), $s->to()->toDateString()])
            ->whereNotNull('fired_at')->orderBy('date')->get();
        $checks = AttendanceCheck::where('user_id', $userId)->whereIn('date', $days->pluck('date'))->get()->keyBy('date');
        $list = $days->map(fn (AttendanceDay $d) => [
            'date' => $d->date,
            'sent_at' => $d->send_at->toIso8601String(),
            'status' => $checks->get($d->date)?->status,
            'responded_at' => $checks->get($d->date)?->responded_at?->toIso8601String(),
        ])->filter(fn ($d) => $d['status'] !== null)->values();
        return ['days' => $list, 'rate' => $this->rate($checks->values())];
    }

    private function missedDeadlines(User $user, PerformanceScores $s): array
    {
        $tasks = $s->dueTasks(fn ($q) => $q->where('assignee_id', $user->id)->with('project:id,name'))
            ->reject(fn (Task $t) => PerformanceScores::wasOnTime($t));
        $extensions = DeadlineExtensionRequest::whereIn('task_id', $tasks->pluck('id'))->orderByDesc('id')->get()->groupBy('task_id');

        return $tasks->sortByDesc('deadline')->values()->map(function (Task $t) use ($extensions) {
            $missed = $t->events->firstWhere('type', TaskEvent::DEADLINE_MISSED);
            $ext = $extensions->get($t->id)?->first();
            return [
                'id' => $t->id,
                'title' => $t->title,
                'project' => $t->project?->name,
                'deadline' => $t->deadline->toIso8601String(),
                'cause' => $missed?->meta['cause'] ?? $t->missCause(),
                'extension' => $ext ? ['status' => $ext->status, 'requested_deadline' => $ext->requested_deadline?->toIso8601String()] : null,
            ];
        })->all();
    }
}
