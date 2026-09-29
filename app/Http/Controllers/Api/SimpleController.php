<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeaveApplication;
use App\Models\Booking;
use App\Models\TechnicalSupportRequest;
use App\Models\Complaint;
use App\Models\StaffComplaint;
use App\Models\StaffQuery;
use App\Models\Sop;
use App\Models\SopSegment;
use App\Models\IssueReport;
use App\Models\ReviewLink;
use App\Models\Note;
use App\Models\ClientSentiment;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class SimpleController extends Controller
{
    private const LEAVE_OF_ABSENCE_ANNUAL_CAP = 14;

    // ==================== LEAVE ====================
    public function leaveIndex(Request $request)
    {
        $user = $request->user();
        $query = LeaveApplication::with(['user', 'reviewer']);

        if (in_array($user->role, ['staff', 'intern', 'project_manager'])) {
            $query->where('user_id', $user->id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function leaveStore(Request $request)
    {
        $data = $request->validate([
            'leave_type' => 'required|string|in:day_off,leave_of_absence',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'reason' => 'nullable|string',
        ]);

        $start = Carbon::parse($data['start_date']);
        $end = Carbon::parse($data['end_date']);
        $workingDays = 0;
        for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
            if (!$d->isWeekend()) {
                $workingDays++;
            }
        }

        if ($data['leave_type'] === 'leave_of_absence') {
            $year = $start->year;
            $used = LeaveApplication::where('user_id', $request->user()->id)
                ->where('leave_type', 'leave_of_absence')
                ->where('status', '!=', 'rejected')
                ->whereYear('start_date', $year)
                ->sum('total_days');

            if ($used + $workingDays > self::LEAVE_OF_ABSENCE_ANNUAL_CAP) {
                $remaining = max(0, self::LEAVE_OF_ABSENCE_ANNUAL_CAP - $used);
                return response()->json([
                    'message' => "This request exceeds your Leave of Absence allowance for {$year}. You have {$remaining} of " . self::LEAVE_OF_ABSENCE_ANNUAL_CAP . " working days remaining.",
                ], 422);
            }
        }

        $data['user_id'] = $request->user()->id;
        $data['status'] = 'pending';
        $data['total_days'] = $workingDays;

        $leave = LeaveApplication::create($data);
        $leave->load('user');

        $recipientIds = User::whereIn('role', ['operations_manager', 'team_lead'])
            ->where('id', '!=', $request->user()->id)
            ->pluck('id');
        foreach ($recipientIds as $recipientId) {
            NotificationService::send(
                $recipientId,
                'leave_application',
                'New Leave Application',
                "{$leave->user->first_name} submitted a leave request ({$leave->start_date} – {$leave->end_date}).",
                $leave->id,
                'leave_application',
            );
        }

        return response()->json($leave, 201);
    }

    public function leaveDecide(Request $request, LeaveApplication $leave)
    {
        $this->authorizeRole($request, ['operations_manager', 'team_lead']);
        $data = $request->validate([
            'status' => 'required|in:approved,rejected',
            'review_comment' => 'nullable|string',
        ]);
        $data['reviewed_by'] = $request->user()->id;
        $data['reviewed_at'] = now();

        $leave->update($data);

        $label = $data['status'] === 'approved' ? 'Approved' : 'Rejected';
        NotificationService::send(
            $leave->user_id,
            'leave_decided',
            "Leave Application {$label}",
            "Your leave request ({$leave->start_date} – {$leave->end_date}) was {$data['status']}.",
            $leave->id,
            'leave_application',
        );

        return response()->json($leave->load(['user', 'reviewer']));
    }

    // ==================== BOOKINGS ====================
    public function bookingIndex(Request $request)
    {
        return response()->json(
            Booking::with('scheduler')->orderBy('start_time', 'asc')->get()
        );
    }

    public function bookingStore(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'description' => 'nullable|string',
            'start_time' => 'required|date',
            'end_time' => 'required|date|after:start_time',
            'location' => 'nullable|string',
            'meeting_link' => 'nullable|string',
            'participants' => 'nullable|array',
            'type' => 'required|in:one_on_one,team,marketing_meeting_call,general',
        ]);
        $data['scheduled_by'] = $request->user()->id;

        $booking = Booking::create($data);
        $booking->load('scheduler');

        foreach ($booking->participants ?? [] as $participantId) {
            if ($participantId !== $request->user()->id) {
                NotificationService::send(
                    $participantId,
                    'booking_invite',
                    'Meeting Invitation',
                    "{$request->user()->first_name} {$request->user()->last_name} invited you to \"{$booking->title}\" on " . $booking->start_time->format('M j, Y \a\t g:i A'),
                    $booking->id,
                    'booking',
                );
            }
        }

        return response()->json($booking, 201);
    }

    public function bookingUpdate(Request $request, Booking $booking)
    {
        $booking->update($request->validate([
            'title' => 'sometimes|string',
            'description' => 'nullable|string',
            'start_time' => 'sometimes|date',
            'end_time' => 'sometimes|date',
            'location' => 'nullable|string',
            'meeting_link' => 'nullable|string',
            'participants' => 'nullable|array',
            'type' => 'sometimes|in:one_on_one,team,marketing_meeting_call,general',
        ]));
        return response()->json($booking);
    }

    public function bookingDestroy(Booking $booking)
    {
        $booking->delete();
        return response()->json(['message' => 'Booking deleted.']);
    }

    // ==================== TECHNICAL SUPPORT ====================
    public function supportIndex(Request $request)
    {
        $user = $request->user();
        $query = TechnicalSupportRequest::with(['requester', 'assignedTo']);

        if (in_array($user->role, ['staff', 'intern'])) {
            $query->where('requester_id', $user->id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function supportStore(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'description' => 'required|string',
            'task_id' => 'nullable|integer|exists:tasks,id',
            'priority' => 'nullable|string',
        ]);
        $data['requester_id'] = $request->user()->id;
        $data['status'] = 'open';

        $req = TechnicalSupportRequest::create($data);
        $req->load('requester');

        $recipientIds = User::where('specialization', 'technical_support')
            ->where('id', '!=', $request->user()->id)
            ->pluck('id');
        foreach ($recipientIds as $recipientId) {
            NotificationService::send(
                $recipientId,
                'support_request',
                'New Support Request',
                "{$req->requester->first_name} submitted a support request: \"{$req->title}\"",
                $req->id,
                'technical_support_request',
            );
        }

        return response()->json($req, 201);
    }

    public function supportUpdate(Request $request, TechnicalSupportRequest $support)
    {
        $data = $request->validate([
            'status' => 'sometimes|string',
            'assigned_to_id' => 'nullable|integer|exists:users,id',
            'resolution' => 'nullable|string',
            'resolved_at' => 'nullable|date',
        ]);
        $support->update($data);

        if ($support->requester_id && $support->requester_id !== $request->user()->id) {
            $status = $data['status'] ?? $support->status;
            NotificationService::send(
                $support->requester_id,
                'support_updated',
                'Support Request Updated',
                "Your technical support request \"{$support->title}\" is now {$status}.",
                $support->id,
                'technical_support_request',
            );
        }

        return response()->json($support->load(['requester', 'assignedTo']));
    }

    // ==================== COMPLAINTS ====================
    public function complaintIndex(Request $request)
    {
        $user = $request->user();
        $query = Complaint::query();

        if ($user->role !== 'operations_manager' && $user->role !== 'team_lead') {
            $query->where('submitter_id', $user->id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function complaintStore(Request $request)
    {
        if ($request->user()->role !== 'client') {
            abort(403);
        }

        $data = $request->validate([
            'name' => 'required|string',
            'email' => 'required|email',
            'product_manager_name' => 'nullable|string',
            'developer_name' => 'nullable|string',
            'technical_manager_name' => 'nullable|string',
            'valuable_things' => 'nullable|array',
            'detailed_explanation' => 'required|string',
            'screenshot_url' => 'nullable|string',
        ]);
        $data['submitter_id'] = $request->user()->id;
        $data['status'] = 'pending';

        $complaint = Complaint::create($data);

        $recipientIds = User::whereIn('role', ['operations_manager', 'team_lead'])->pluck('id');
        foreach ($recipientIds as $recipientId) {
            NotificationService::send(
                $recipientId,
                'client_complaint',
                'New Client Complaint',
                "A new client complaint was submitted by {$complaint->name}.",
                $complaint->id,
                'complaint',
            );
        }

        return response()->json($complaint, 201);
    }

    public function complaintUpdate(Request $request, Complaint $complaint)
    {
        $this->authorizeRole($request, ['operations_manager', 'team_lead']);
        $data = $request->validate([
            'status' => 'sometimes|in:pending,reviewed,resolved',
            'review_comments' => 'nullable|string',
        ]);
        if (isset($data['status'])) {
            $data['reviewed_by'] = $request->user()->id;
            $data['reviewed_at'] = now();
        }
        $complaint->update($data);

        if ($complaint->submitter_id && $complaint->submitter_id !== $request->user()->id) {
            $status = $data['status'] ?? $complaint->status;
            NotificationService::send(
                $complaint->submitter_id,
                'complaint_updated',
                'Complaint Updated',
                "Your complaint status has been updated to: {$status}.",
                $complaint->id,
                'complaint',
            );
        }

        return response()->json($complaint);
    }

    // ==================== STAFF COMPLAINTS ====================
    public function staffComplaintIndex(Request $request)
    {
        $user = $request->user();
        $query = StaffComplaint::with('submitter');

        if (!in_array($user->role, ['operations_manager', 'team_lead'])) {
            $query->where('submitter_id', $user->id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function staffComplaintStore(Request $request)
    {
        if (in_array($request->user()->role, ['operations_manager', 'team_lead', 'client'])) {
            abort(403);
        }

        $data = $request->validate([
            'name' => 'required|string',
            'email' => 'required|email',
            'department' => 'nullable|string',
            'detailed_explanation' => 'required|string',
            'screenshot_url' => 'nullable|string',
        ]);
        $data['submitter_id'] = $request->user()->id;
        $data['status'] = 'pending';

        $complaint = StaffComplaint::create($data);

        $recipientIds = User::whereIn('role', ['operations_manager', 'team_lead'])->pluck('id');
        foreach ($recipientIds as $recipientId) {
            NotificationService::send(
                $recipientId,
                'staff_complaint',
                'New Staff Complaint',
                "{$complaint->name} submitted a staff complaint.",
                $complaint->id,
                'staff_complaint',
            );
        }

        return response()->json($complaint, 201);
    }

    public function staffComplaintUpdate(Request $request, StaffComplaint $complaint)
    {
        $this->authorizeRole($request, ['operations_manager', 'team_lead']);
        $data = $request->validate([
            'status' => 'sometimes|in:pending,reviewed,resolved',
            'review_comments' => 'nullable|string',
        ]);
        if (isset($data['status'])) {
            $data['reviewed_at'] = now();
        }
        $complaint->update($data);

        if ($complaint->submitter_id && $complaint->submitter_id !== $request->user()->id) {
            $status = $data['status'] ?? $complaint->status;
            NotificationService::send(
                $complaint->submitter_id,
                'staff_complaint_updated',
                'Staff Complaint Updated',
                "Your staff complaint status has been updated to: {$status}.",
                $complaint->id,
                'staff_complaint',
            );
        }

        return response()->json($complaint);
    }

    // ==================== CLIENT SENTIMENT ====================
    // Clients self-report a general weekly satisfied/dissatisfied check-in
    // (optionally flagged for follow-up). Only team lead/ops manager review.
    public function sentimentIndex(Request $request)
    {
        $user = $request->user();
        $query = ClientSentiment::with('client');

        if ($user->role !== 'operations_manager' && $user->role !== 'team_lead') {
            $query->where('client_id', $user->id);
        }

        return response()->json($query->orderBy('recorded_at', 'desc')->get());
    }

    public function sentimentStore(Request $request)
    {
        if ($request->user()->role !== 'client') {
            abort(403);
        }

        $data = $request->validate([
            'sentiment' => 'required|in:satisfied,dissatisfied',
            'feedback' => 'nullable|string',
            'is_flagged' => 'nullable|boolean',
        ]);
        $data['is_flagged'] = $data['is_flagged'] ?? false;
        $data['client_id'] = $request->user()->id;
        $data['recorded_by'] = $request->user()->id;
        $data['recorded_at'] = now();

        $sentiment = ClientSentiment::create($data);

        if ($sentiment->is_flagged) {
            $recipientIds = User::whereIn('role', ['operations_manager', 'team_lead'])->pluck('id');
            foreach ($recipientIds as $recipientId) {
                NotificationService::send(
                    $recipientId,
                    'client_sentiment_flagged',
                    'Client Feedback Flagged',
                    "{$request->user()->first_name} flagged their feedback for follow-up.",
                    $sentiment->id,
                    'client_sentiment',
                );
            }
        }

        return response()->json($sentiment, 201);
    }

    // ==================== STAFF QUERIES ====================
    // Managers (operations_manager, team_lead) issue a query to a specific staff
    // member, who must then acknowledge it or contest it with a reason.
    // Every non-client role can see every query, not just their own.
    private const QUERY_ISSUER_ROLES = ['operations_manager', 'team_lead'];
    private const QUERY_TARGET_ROLES = ['project_manager', 'staff', 'intern', 'customer_support_officer'];

    public function queryIndex(Request $request)
    {
        if ($request->user()->role === 'client') {
            abort(403);
        }

        $query = StaffQuery::with(['submitter', 'assignee']);

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function queryStore(Request $request)
    {
        if (!in_array($request->user()->role, self::QUERY_ISSUER_ROLES)) {
            abort(403);
        }

        $data = $request->validate([
            'subject' => 'required|string',
            'message' => 'required|string',
            'assigned_to' => ['required', 'integer', Rule::exists('users', 'id')->where(
                fn ($q) => $q->whereIn('role', self::QUERY_TARGET_ROLES)
            )],
        ]);
        $data['submitted_by'] = $request->user()->id;
        $data['status'] = 'pending';

        $q = StaffQuery::create($data);
        $q->load(['submitter', 'assignee']);

        NotificationService::send(
            $q->assigned_to,
            'staff_query_issued',
            'You Have Been Issued a Query',
            "{$q->submitter->first_name} issued you a query: \"{$q->subject}\"",
            $q->id,
            'staff_query',
        );

        return response()->json($q, 201);
    }

    public function queryRespond(Request $request, StaffQuery $staffQuery)
    {
        if ($staffQuery->assigned_to !== $request->user()->id) {
            abort(403);
        }

        $data = $request->validate([
            'status' => 'required|in:acknowledged,contested',
            'response' => 'required_if:status,contested|nullable|string',
        ]);

        $staffQuery->update([
            'status' => $data['status'],
            'response' => $data['response'] ?? null,
            'responded_at' => now(),
        ]);

        if ($staffQuery->submitted_by && $staffQuery->submitted_by !== $request->user()->id) {
            $label = $data['status'] === 'acknowledged' ? 'acknowledged' : 'contested';
            NotificationService::send(
                $staffQuery->submitted_by,
                "query_{$data['status']}",
                'Query ' . ucfirst($label),
                "Your query \"{$staffQuery->subject}\" has been {$label}.",
                $staffQuery->id,
                'staff_query',
            );
        }

        return response()->json($staffQuery);
    }

    public function queryDestroy(Request $request, StaffQuery $staffQuery)
    {
        if ($staffQuery->submitted_by !== $request->user()->id && !in_array($request->user()->role, ['operations_manager', 'team_lead'])) {
            abort(403);
        }

        $staffQuery->delete();
        return response()->json(['message' => 'Query deleted.']);
    }

    // ==================== SOPs ====================
    public function sopIndex()
    {
        return response()->json(Sop::with('segments')->orderBy('created_at', 'desc')->get());
    }

    public function sopStore(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'description' => 'nullable|string',
            'category' => 'nullable|string',
        ]);
        $data['created_by'] = $request->user()->id;
        $data['status'] = 'active';

        $sop = Sop::create($data);
        return response()->json($sop, 201);
    }

    public function sopShow(Sop $sop)
    {
        return response()->json($sop->load(['creator', 'segments']));
    }

    public function sopUpdate(Request $request, Sop $sop)
    {
        $sop->update($request->validate([
            'title' => 'sometimes|string',
            'description' => 'nullable|string',
            'category' => 'nullable|string',
            'status' => 'nullable|string',
        ]));
        return response()->json($sop);
    }

    public function sopDestroy(Sop $sop)
    {
        $sop->delete();
        return response()->json(['message' => 'SOP deleted.']);
    }

    public function sopSegmentStore(Request $request, Sop $sop)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'content' => 'required|string',
            'order_index' => 'nullable|integer',
        ]);
        $data['sop_id'] = $sop->id;

        $segment = SopSegment::create($data);
        return response()->json($segment, 201);
    }

    public function sopSegmentUpdate(Request $request, Sop $sop, SopSegment $segment)
    {
        $segment->update($request->validate([
            'title' => 'sometimes|string',
            'content' => 'sometimes|string',
            'order_index' => 'nullable|integer',
        ]));
        return response()->json($segment);
    }

    public function sopSegmentDestroy(Sop $sop, SopSegment $segment)
    {
        $segment->delete();
        return response()->json(['message' => 'Segment deleted.']);
    }

    // ==================== ISSUE REPORTS ====================
    // Anyone can submit an app issue/suggestion. Only staff whose specialization
    // is technical_support manage the queue (see all reports, change status, comment).
    private static function isTechSupport(User $user): bool
    {
        return $user->role === 'staff' && $user->specialization === 'technical_support';
    }

    public function issueIndex(Request $request)
    {
        $user = $request->user();
        $query = IssueReport::with(['reporter', 'project', 'task']);

        if (!self::isTechSupport($user)) {
            $query->where('reported_by', $user->id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function issueStore(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'description' => 'required|string',
            'category' => 'nullable|string|in:bug,feature_request,improvement,other',
            'suggestions' => 'nullable|string',
            'project_id' => 'nullable|integer|exists:projects,id',
            'task_id' => 'nullable|integer|exists:tasks,id',
            'priority' => 'nullable|string',
            'screenshot_url' => 'nullable|string',
        ]);
        $data['reported_by'] = $request->user()->id;
        $data['status'] = 'pending';

        $issue = IssueReport::create($data);
        $issue->load('reporter');

        $recipientIds = User::where('role', 'staff')
            ->where('specialization', 'technical_support')
            ->where('id', '!=', $request->user()->id)
            ->pluck('id');
        foreach ($recipientIds as $recipientId) {
            NotificationService::send(
                $recipientId,
                'issue_report',
                'New Issue Report',
                "{$issue->reporter->first_name} reported an issue: \"{$issue->title}\"",
                $issue->id,
                'issue_report',
            );
        }

        return response()->json($issue, 201);
    }

    public function issueUpdate(Request $request, IssueReport $issue)
    {
        if (!self::isTechSupport($request->user())) {
            abort(403);
        }

        $data = $request->validate([
            'status' => 'sometimes|in:pending,reviewing,resolved,closed',
            'resolution' => 'nullable|string',
            'priority' => 'nullable|string',
        ]);

        if (($data['status'] ?? null) === 'resolved' && $issue->status !== 'resolved') {
            $data['resolved_at'] = now();
        }

        $issue->update($data);

        if (isset($data['status']) && $issue->reported_by && $issue->reported_by !== $request->user()->id) {
            NotificationService::send(
                $issue->reported_by,
                'issue_report_updated',
                'Issue Report Updated',
                "Your issue report \"{$issue->title}\" is now {$data['status']}.",
                $issue->id,
                'issue_report',
            );
        }

        return response()->json($issue);
    }

    // ==================== REVIEW LINKS ====================
    public function reviewLinkIndex(Request $request)
    {
        $user = $request->user();
        $query = ReviewLink::with(['sender', 'assignee']);

        if ($user->role === 'client') {
            $query->where('assigned_to', $user->id);
        } elseif (!in_array($user->role, ['operations_manager', 'team_lead', 'project_manager'])) {
            $query->where('sent_by', $user->id)->orWhere('assigned_to', $user->id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function reviewLinkStore(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'link_url' => 'required|url',
            'description' => 'nullable|string',
            'assigned_to' => 'nullable|integer|exists:users,id',
        ]);
        $data['sent_by'] = $request->user()->id;
        $data['status'] = 'pending';

        $link = ReviewLink::create($data);

        if (!empty($link->assigned_to) && $link->assigned_to !== $request->user()->id) {
            NotificationService::send(
                $link->assigned_to,
                'review_link_assigned',
                'Review Link Assigned',
                "You have a new review link to review: \"{$link->title}\"",
                $link->id,
                'review_link',
            );
        }

        return response()->json($link->load(['sender', 'assignee']), 201);
    }

    public function reviewLinkRespond(Request $request, ReviewLink $reviewLink)
    {
        $data = $request->validate([
            'status' => 'required|in:approved,not_approved',
            'review_comment' => 'nullable|string',
        ]);

        $reviewLink->update([
            'status' => $data['status'],
            'review_comment' => $data['review_comment'] ?? null,
            'reviewed_at' => now(),
        ]);

        if ($reviewLink->sent_by && $reviewLink->sent_by !== $request->user()->id) {
            $label = $data['status'] === 'approved' ? 'approved' : 'marked as not approved';
            NotificationService::send(
                $reviewLink->sent_by,
                'review_link_reviewed',
                'Review Link Reviewed',
                "Your review link \"{$reviewLink->title}\" has been {$label}.",
                $reviewLink->id,
                'review_link',
            );
        }

        return response()->json($reviewLink);
    }

    public function reviewLinkDestroy(Request $request, ReviewLink $reviewLink)
    {
        if ($reviewLink->sent_by !== $request->user()->id && !in_array($request->user()->role, ['operations_manager', 'team_lead'])) {
            abort(403);
        }

        $reviewLink->delete();
        return response()->json(['message' => 'Review link deleted.']);
    }

    // ==================== NOTES ====================
    public function noteIndex(Request $request)
    {
        return response()->json(
            Note::where('user_id', $request->user()->id)->orderBy('created_at', 'desc')->get()
        );
    }

    public function noteStore(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'content' => 'nullable|string',
            'todo_items' => 'nullable|array',
            'color' => 'nullable|string',
        ]);
        $data['user_id'] = $request->user()->id;

        $note = Note::create($data);
        return response()->json($note, 201);
    }

    public function noteUpdate(Request $request, Note $note)
    {
        if ($note->user_id !== $request->user()->id) abort(403);

        $note->update($request->validate([
            'title' => 'sometimes|string',
            'content' => 'nullable|string',
            'todo_items' => 'nullable|array',
            'color' => 'nullable|string',
        ]));
        return response()->json($note);
    }

    public function noteDestroy(Request $request, Note $note)
    {
        if ($note->user_id !== $request->user()->id) abort(403);
        $note->delete();
        return response()->json(['message' => 'Note deleted.']);
    }

    private function authorizeRole(Request $request, array $roles)
    {
        if (!in_array($request->user()->role, $roles)) {
            abort(403, 'Unauthorized');
        }
    }
}
