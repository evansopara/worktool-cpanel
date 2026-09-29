<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ProjectPlan;
use App\Models\Deliverable;
use App\Models\Resource;
use App\Models\ProjectBriefing;
use App\Services\NotificationService;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Project::with(['client', 'manager', 'creator', 'members']);

        if (in_array($user->role, ['staff', 'intern'])) {
            $query->whereHas('members', fn($q) => $q->where('user_id', $user->id));
        } elseif ($user->role === 'project_manager') {
            $query->where('manager_id', $user->id)
                  ->orWhereHas('members', fn($q) => $q->where('user_id', $user->id));
        } elseif ($user->role === 'client') {
            $query->where('client_id', $user->id);
        }

        return response()->json($query->orderBy('created_at', 'desc')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'description' => 'nullable|string',
            'category' => 'required|string|in:website_development,dpl_outright,dpl_partnership,direct_marketing,support_maintenance',
            'client_id' => 'nullable|integer',
            'status' => 'nullable|string|in:active,inactive,pending,completed',
            'progress' => 'nullable|integer|min:0|max:100',
            'start_date' => 'required|date',
            'end_date' => 'required|date',
            'domain_registered_at' => 'nullable|date',
            'domain_expires_at' => 'nullable|date',
            'member_ids' => 'nullable|array',
            'member_ids.*' => 'integer',
        ]);

        $memberIds = $data['member_ids'] ?? [];
        unset($data['member_ids']);
        $data['created_by'] = $request->user()->id;
        $data['type'] = $data['category'];
        $data['manager_id'] = $data['manager_id'] ?? $request->user()->id;

        $project = Project::create($data);

        $validUserIds = \App\Models\User::whereIn('id', $memberIds)->pluck('id')->toArray();
        foreach ($validUserIds as $userId) {
            ProjectMember::firstOrCreate(
                ['project_id' => $project->id, 'user_id' => $userId],
                ['invitation_status' => 'accepted']
            );
        }

        // Auto-add the creator as a project member
        ProjectMember::firstOrCreate(
            ['project_id' => $project->id, 'user_id' => $request->user()->id],
            ['invitation_status' => 'accepted']
        );

        if (!empty($project->manager_id) && $project->manager_id !== $request->user()->id) {
            NotificationService::send(
                $project->manager_id,
                'project_assigned',
                'Assigned as Project Manager',
                "You have been assigned as manager of the project: \"{$project->name}\"",
                $project->id,
                'project',
            );
        }

        return response()->json($project->load(['client', 'manager', 'creator', 'members.user']), 201);
    }

    public function show(Request $request, Project $project)
    {
        $this->authorizeProjectAccess($request->user(), $project);
        return response()->json($project->load(['client', 'manager', 'creator', 'members.user', 'tasks', 'plans.deliverables', 'resources']));
    }

    public function update(Request $request, Project $project)
    {
        $data = $request->validate([
            'name' => 'sometimes|string',
            'description' => 'nullable|string',
            'category' => 'sometimes|string|in:website_development,dpl_outright,dpl_partnership,direct_marketing,support_maintenance',
            'client_id' => 'nullable|integer',
            'manager_id' => 'nullable|integer',
            'status' => 'nullable|string|in:active,inactive,pending,completed',
            'progress' => 'nullable|integer|min:0|max:100',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
            'domain_registered_at' => 'nullable|date',
            'domain_expires_at' => 'nullable|date',
        ]);

        $oldManagerId = $project->manager_id;
        $oldStatus = $project->status;
        $oldDomainExpiresAt = $project->domain_expires_at?->toDateString();

        // Domain expiry date changed: allow the expiry check command to notify again.
        if (array_key_exists('domain_expires_at', $data) && $data['domain_expires_at'] !== $oldDomainExpiresAt) {
            $data['domain_expiry_notified_at'] = null;
        }

        $project->update($data);

        if (isset($data['manager_id']) && $data['manager_id'] !== $oldManagerId && $data['manager_id'] !== $request->user()->id) {
            NotificationService::send(
                $data['manager_id'],
                'project_assigned',
                'Assigned as Project Manager',
                "You have been assigned as manager of the project: \"{$project->name}\"",
                $project->id,
                'project',
            );
        }

        if (isset($data['status']) && $data['status'] !== $oldStatus && $project->manager_id && $project->manager_id !== $request->user()->id) {
            NotificationService::send(
                $project->manager_id,
                'project_status_changed',
                'Project Status Updated',
                "The status of project \"{$project->name}\" changed to {$data['status']}.",
                $project->id,
                'project',
            );
        }

        return response()->json($project->load(['client', 'manager']));
    }

    public function destroy(Project $project)
    {
        $project->delete();
        return response()->json(['message' => 'Project deleted.']);
    }

    // Members
    public function members(Project $project)
    {
        return response()->json($project->members()->with('user')->get());
    }

    public function addMember(Request $request, Project $project)
    {
        $user = $request->user();
        $allowedRoles = ['operations_manager', 'team_lead', 'project_manager', 'customer_support_officer'];
        if (!in_array($user->role, $allowedRoles)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'user_id' => 'required|integer',
            'role' => 'nullable|string',
        ]);

        $member = ProjectMember::firstOrCreate(
            ['project_id' => $project->id, 'user_id' => $data['user_id']],
            ['role' => $data['role'] ?? null, 'invitation_status' => 'accepted']
        );

        if ($data['user_id'] !== $request->user()->id) {
            NotificationService::send(
                $data['user_id'],
                'project_member_added',
                'Added to Project',
                "You have been added to the project: \"{$project->name}\"",
                $project->id,
                'project',
            );
        }

        return response()->json($member->load('user'), 201);
    }

    public function removeMember(Project $project, $userId)
    {
        ProjectMember::where('project_id', $project->id)->where('user_id', $userId)->delete();
        return response()->json(['message' => 'Member removed.']);
    }

    // Plans
    public function plans(Project $project)
    {
        return response()->json($project->plans()->with('deliverables')->get());
    }

    public function storePlan(Request $request, Project $project)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'description' => 'nullable|string',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);
        $data['project_id'] = $project->id;
        $data['created_by'] = $request->user()->id;

        $plan = ProjectPlan::create($data);
        return response()->json($plan, 201);
    }

    public function updatePlan(Request $request, Project $project, ProjectPlan $plan)
    {
        $plan->update($request->validate(['title' => 'sometimes|string', 'description' => 'nullable|string']));
        return response()->json($plan);
    }

    public function destroyPlan(Project $project, ProjectPlan $plan)
    {
        $plan->delete();
        return response()->json(['message' => 'Plan deleted.']);
    }

    // Deliverables
    public function storeDeliverable(Request $request, Project $project, ProjectPlan $plan)
    {
        $data = $request->validate([
            'title' => 'required|string',
            'description' => 'nullable|string',
            'start_date' => 'nullable|date',
            'due_date' => 'nullable|date',
            'status' => 'nullable|string',
            'dependencies' => 'nullable|array',
        ]);
        $data['plan_id'] = $plan->id;

        $deliverable = Deliverable::create($data);
        return response()->json($deliverable, 201);
    }

    public function updateDeliverable(Request $request, Project $project, ProjectPlan $plan, Deliverable $deliverable)
    {
        $data = $request->validate([
            'title' => 'sometimes|string',
            'description' => 'nullable|string',
            'assigned_to' => 'nullable|integer',
            'due_date' => 'nullable|date',
            'status' => 'nullable|string',
        ]);
        $oldAssignedTo = $deliverable->assigned_to;
        $deliverable->update($data);

        if (isset($data['assigned_to']) && $data['assigned_to'] !== $oldAssignedTo && $data['assigned_to'] !== $request->user()->id) {
            NotificationService::send(
                $data['assigned_to'],
                'deliverable_assigned',
                'Deliverable Assigned',
                "You have been assigned the deliverable \"{$deliverable->title}\" on project \"{$project->name}\"",
                $deliverable->id,
                'deliverable',
            );
        }

        return response()->json($deliverable);
    }

    public function destroyDeliverable(Project $project, ProjectPlan $plan, Deliverable $deliverable)
    {
        $deliverable->delete();
        return response()->json(['message' => 'Deliverable deleted.']);
    }

    // Resources
    public function resources(Project $project)
    {
        return response()->json($project->resources()->with('uploader')->get());
    }

    public function storeResource(Request $request, Project $project)
    {
        $data = $request->validate([
            'name' => 'required|string',
            'url' => 'required|string',
            'type' => 'nullable|string',
        ]);
        $data['project_id'] = $project->id;
        $data['uploaded_by'] = $request->user()->id;

        $resource = Resource::create($data);

        $recipientIds = ProjectMember::where('project_id', $project->id)
            ->where('user_id', '!=', $request->user()->id)
            ->pluck('user_id');
        foreach ($recipientIds as $recipientId) {
            NotificationService::send(
                $recipientId,
                'resource_uploaded',
                'New Project File',
                "{$request->user()->name} uploaded a file to \"{$project->name}\": \"{$resource->name}\"",
                $resource->id,
                'resource',
            );
        }

        return response()->json($resource, 201);
    }

    public function destroyResource(Project $project, Resource $resource)
    {
        $resource->delete();
        return response()->json(['message' => 'Resource deleted.']);
    }

    // Briefing
    public function briefing(Project $project)
    {
        return response()->json($project->briefing ?? (object)[]);
    }

    public function storeBriefing(Request $request, Project $project)
    {
        $data = $request->validate(['content' => 'required|string']);
        $briefing = ProjectBriefing::updateOrCreate(
            ['project_id' => $project->id],
            ['content' => $data['content'], 'created_by' => $request->user()->id, 'updated_by' => $request->user()->id]
        );
        return response()->json($briefing, 201);
    }

    private function authorizeProjectAccess($user, Project $project)
    {
        if (in_array($user->role, ['operations_manager', 'team_lead'])) return;
        if ($user->role === 'client' && $project->client_id === $user->id) return;
        if ($project->manager_id === $user->id) return;
        if (ProjectMember::where('project_id', $project->id)->where('user_id', $user->id)->exists()) return;
        abort(403, 'Unauthorized');
    }
}
