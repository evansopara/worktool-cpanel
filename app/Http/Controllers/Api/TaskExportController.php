<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\TaskRuleException;
use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Support\XlsxWriter;
use Illuminate\Http\Request;

/**
 * GET /tasks/export?format=xlsx|csv|json&tab=&q=&from=&to= — every task
 * matching the list's current filters, not just one page (spec §7.2).
 * PDF is drawn in the browser from format=json, since the server has no PDF
 * library. Large exports are refused rather than queued for now.
 */
class TaskExportController extends Controller
{
    public const MAX_ROWS = 5000;

    private const HEADER = ['Task', 'Project', 'Status', 'Assignee', 'Assigned by', 'Scheduled start', 'Deadline', 'Estimate', 'Time logged'];

    public function __invoke(Request $request, TaskController $tasks)
    {
        $request->validate([
            'format' => 'required|in:xlsx,csv,json',
            'tab' => 'nullable|in:all,mine,active,completed',
            'q' => 'nullable|string|max:200',
            'from' => 'nullable|date_format:Y-m-d',
            'to' => 'nullable|date_format:Y-m-d',
        ]);

        $query = $tasks->listQuery($request, $request->user());
        $total = (clone $query)->count();
        if ($total > self::MAX_ROWS) {
            throw new TaskRuleException('too_many', "That's {$total} tasks. Narrow the date range or search to export at most " . self::MAX_ROWS . '.');
        }

        $rows = $query->get()->map(fn (Task $t) => [
            $t->title,
            $t->project->name ?? '',
            str_replace('_', ' ', ucfirst((string) $t->status)),
            $t->assignee?->fullName() ?? '',
            $t->assigner?->fullName() ?? '',
            $t->start_date?->format('Y-m-d H:i') ?? '',
            $t->deadline?->format('Y-m-d H:i') ?? '',
            self::duration($t->estimateMinutes() * 60),
            self::duration($t->loggedSeconds()),
        ])->all();

        $name = 'tasks-' . now()->format('Y-m-d');

        return match ($request->input('format')) {
            'json' => response()->json(['header' => self::HEADER, 'rows' => $rows, 'filename' => $name]),
            'csv' => response()->streamDownload(function () use ($rows) {
                $out = fopen('php://output', 'w');
                fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel reads names correctly
                fputcsv($out, self::HEADER, escape: '');
                foreach ($rows as $row) {
                    fputcsv($out, $row, escape: '');
                }
                fclose($out);
            }, "{$name}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']),
            'xlsx' => response()->download(XlsxWriter::write(self::HEADER, $rows), "{$name}.xlsx", [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ])->deleteFileAfterSend(),
        };
    }

    /** "2h 05m", or "" for nothing. */
    private static function duration(int $seconds): string
    {
        if ($seconds <= 0) {
            return '';
        }
        $minutes = intdiv($seconds, 60);
        return sprintf('%dh %02dm', intdiv($minutes, 60), $minutes % 60);
    }
}
