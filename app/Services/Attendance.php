<?php

namespace App\Services;

use App\Models\AttendanceCheck;
use App\Models\AttendanceDay;
use App\Models\LeaveApplication;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The daily attendance check (Performance page spec §5).
 *
 * One time per working day (Mon–Fri), the same for everyone, picked at random
 * between 10:00 AM and 4:30 PM outside 1–2 PM. Answer within 30 minutes =
 * answered, after that = missed. People on approved leave
 * are skipped. Everyone except Team Leads is checked (decided 2026-11-06).
 */
class Attendance
{
    public const CHECKED_ROLES = ['operations_manager', 'project_manager', 'customer_support_officer', 'staff', 'intern'];

    public const ON_TIME_MINUTES = 30;

    private const WINDOW_START = '10:00';
    private const WINDOW_END = '16:30';
    private const LUNCH_START = '13:00';
    private const LUNCH_END = '14:00';

    /** Called every minute by attendance:run. */
    public static function tick(?Carbon $now = null): void
    {
        $now ??= now();
        self::pickDay($now);
        self::fire($now);
        self::settle($now);
    }

    public static function isWorkingDay(Carbon $date): bool
    {
        return $date->isWeekday();
    }

    /**
     * Store today's send time if it isn't set yet. Only minutes still ahead
     * are drawn, so a scheduler that starts late in the day still sends one.
     */
    public static function pickDay(Carbon $now): ?AttendanceDay
    {
        if (!self::isWorkingDay($now)) {
            return null;
        }
        $date = $now->toDateString();
        if ($day = AttendanceDay::whereDate('date', $date)->first()) {
            return $day;
        }

        $minutes = [];
        $at = Carbon::parse("$date " . self::WINDOW_START);
        $end = Carbon::parse("$date " . self::WINDOW_END);
        $lunchStart = Carbon::parse("$date " . self::LUNCH_START);
        $lunchEnd = Carbon::parse("$date " . self::LUNCH_END);
        for (; $at->lte($end); $at->addMinute()) {
            if ($at->gt($now) && ($at->lt($lunchStart) || $at->gte($lunchEnd))) {
                $minutes[] = $at->copy();
            }
        }
        if (!$minutes) {
            return null; // the window has passed today
        }

        return AttendanceDay::create(['date' => $date, 'send_at' => $minutes[random_int(0, count($minutes) - 1)]]);
    }

    /** People expected to answer a check. */
    public static function checkedUsers(): Collection
    {
        return User::whereIn('role', self::CHECKED_ROLES)->where('is_active', true)->get();
    }

    /** IDs of people on approved leave on this date. */
    public static function onLeave(string $date): Collection
    {
        return LeaveApplication::where('status', 'approved')
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->pluck('user_id')
            ->unique()
            ->values();
    }

    /** At send time: a row per person, then a push to everyone not on leave. */
    public static function fire(Carbon $now): void
    {
        $day = AttendanceDay::whereDate('date', $now->toDateString())->whereNull('fired_at')->where('send_at', '<=', $now)->first();
        if (!$day) {
            return;
        }

        $date = $day->date;
        $leave = self::onLeave($date);
        $notify = [];

        DB::transaction(function () use ($day, $date, $leave, $now, &$notify) {
            // Claim the day first so an overlapping run can't send twice.
            if (AttendanceDay::whereKey($day->id)->whereNull('fired_at')->update(['fired_at' => $now]) === 0) {
                return;
            }
            foreach (self::checkedUsers() as $user) {
                $skipped = $leave->contains($user->id);
                $check = AttendanceCheck::firstOrCreate(
                    ['user_id' => $user->id, 'date' => $date],
                    ['status' => $skipped ? AttendanceCheck::SKIPPED : AttendanceCheck::PENDING, 'notified_at' => $skipped ? null : $day->send_at],
                );
                if (!$skipped) {
                    $notify[] = [$user, $check];
                }
            }
        });

        // Push, email and the in-app bell, after the transaction so a slow
        // mail server can't hold the rows locked.
        $from = $day->send_at->format('g:i A');
        $until = $day->send_at->copy()->addMinutes(self::ON_TIME_MINUTES)->format('g:i A');
        foreach ($notify as [$user, $check]) {
            try {
                NotificationService::send($user->id, 'attendance_check', "Are you there, {$user->first_name}?",
                    "Attendance check: open Worktool and tap \"I'm here\" between {$from} and {$until}.", $check->id, 'attendance_check',
                    pushTag: "attendance-{$date}");
            } catch (\Throwable $e) {
                report($e);
            }
        }
    }

    /**
     * After the 30-minute window: unanswered checks become missed. Nobody is
     * notified — managers see misses on the Attendance tab.
     */
    public static function settle(Carbon $now): void
    {
        $days = AttendanceDay::whereNotNull('fired_at')
            ->where('send_at', '<=', $now->copy()->subMinutes(self::ON_TIME_MINUTES))
            ->pluck('date')
            ->map(fn ($d) => Carbon::parse($d)->toDateString());
        if ($days->isEmpty()) {
            return;
        }

        AttendanceCheck::where('status', AttendanceCheck::PENDING)
            ->whereIn('date', $days)
            ->update(['status' => AttendanceCheck::MISSED]);
    }

    /**
     * Status for an answer at $at to a check sent at $sentAt: answered up to
     * 30 minutes, null after that (too late to answer).
     */
    public static function statusFor(Carbon $sentAt, Carbon $at): ?string
    {
        $seconds = $sentAt->diffInSeconds($at, false);
        if ($seconds <= self::ON_TIME_MINUTES * 60) {
            return AttendanceCheck::ANSWERED;
        }
        return null;
    }

    /** Today's check row once it has fired, with its send time. */
    public static function today(?Carbon $now = null): ?AttendanceDay
    {
        $now ??= now();
        return AttendanceDay::whereDate('date', $now->toDateString())->whereNotNull('fired_at')->first();
    }
}
