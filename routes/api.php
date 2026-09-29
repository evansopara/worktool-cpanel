<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\MessageController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\MemoController;
use App\Http\Controllers\Api\SimpleController;

// Public routes
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/auth/setup-password', [AuthController::class, 'setupPassword']);
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
    Route::post('/tasks/{task}/submit', [\App\Http\Controllers\Api\TaskController::class, 'submit']);

    // Admin: User management
    Route::get('/users', [AuthController::class, 'users']);
    Route::post('/users', [AuthController::class, 'createUser']);
    Route::put('/users/{user}', [AuthController::class, 'updateUser']);
    Route::delete('/users/{user}', [AuthController::class, 'deleteUser']);
    Route::post('/users/{user}/reset-password-token', [AuthController::class, 'resetPasswordToken']);
    Route::post('/users/{user}/deactivate', [AuthController::class, 'deactivateUser']);
    Route::post('/users/{user}/activate', [AuthController::class, 'activateUser']);

    // Projects
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::get('/projects/{project}', [ProjectController::class, 'show']);
    Route::put('/projects/{project}', [ProjectController::class, 'update']);
    Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);

    // Project members
    Route::get('/projects/{project}/members', [ProjectController::class, 'members']);
    Route::post('/projects/{project}/members', [ProjectController::class, 'addMember']);
    Route::delete('/projects/{project}/members/{userId}', [ProjectController::class, 'removeMember']);

    // Project plans & deliverables
    Route::get('/projects/{project}/plans', [ProjectController::class, 'plans']);
    Route::post('/projects/{project}/plans', [ProjectController::class, 'storePlan']);
    Route::put('/projects/{project}/plans/{plan}', [ProjectController::class, 'updatePlan']);
    Route::delete('/projects/{project}/plans/{plan}', [ProjectController::class, 'destroyPlan']);
    Route::post('/projects/{project}/plans/{plan}/deliverables', [ProjectController::class, 'storeDeliverable']);
    Route::put('/projects/{project}/plans/{plan}/deliverables/{deliverable}', [ProjectController::class, 'updateDeliverable']);
    Route::delete('/projects/{project}/plans/{plan}/deliverables/{deliverable}', [ProjectController::class, 'destroyDeliverable']);

    // Project resources
    Route::get('/projects/{project}/resources', [ProjectController::class, 'resources']);
    Route::post('/projects/{project}/resources', [ProjectController::class, 'storeResource']);
    Route::delete('/projects/{project}/resources/{resource}', [ProjectController::class, 'destroyResource']);

    // Project briefing
    Route::get('/projects/{project}/briefing', [ProjectController::class, 'briefing']);
    Route::post('/projects/{project}/briefing', [ProjectController::class, 'storeBriefing']);

    // Client sentiment
    Route::get('/sentiments', [SimpleController::class, 'sentimentIndex']);
    Route::post('/sentiments', [SimpleController::class, 'sentimentStore']);

    // Tasks
    Route::get('/tasks', [TaskController::class, 'index']);
    Route::post('/tasks', [TaskController::class, 'store']);
    Route::get('/tasks/{task}', [TaskController::class, 'show']);
    Route::put('/tasks/{task}', [TaskController::class, 'update']);
    Route::delete('/tasks/{task}', [TaskController::class, 'destroy']);

    // Task timer
    Route::post('/tasks/{task}/timer/start', [TaskController::class, 'startTimer']);
    Route::post('/tasks/{task}/timer/stop', [TaskController::class, 'stopTimer']);

    // Task iterations
    Route::get('/tasks/{task}/iterations', [TaskController::class, 'iterations']);
    Route::post('/tasks/{task}/iterations', [TaskController::class, 'storeIteration']);
    Route::put('/tasks/{task}/iterations/{iteration}', [TaskController::class, 'updateIteration']);

    // Deadline extension requests
    Route::get('/deadline-requests', [TaskController::class, 'deadlineRequests']);
    Route::post('/deadline-requests', [TaskController::class, 'storeDeadlineRequest']);
    Route::put('/deadline-requests/{extensionRequest}/decide', [TaskController::class, 'decideDeadlineRequest']);

    // Messages - Project
    Route::get('/projects/{projectId}/messages', [MessageController::class, 'projectMessages']);
    Route::post('/projects/{projectId}/messages', [MessageController::class, 'sendProjectMessage']);
    Route::put('/messages/project/{message}', [MessageController::class, 'updateProjectMessage']);
    Route::delete('/messages/project/{message}', [MessageController::class, 'deleteProjectMessage']);

    // Messages - Direct
    Route::get('/messages/conversations', [MessageController::class, 'conversations']);
    Route::get('/messages/direct/{userId}', [MessageController::class, 'directMessages']);
    Route::post('/messages/direct/{userId}', [MessageController::class, 'sendDirectMessage']);

    // Messages - General channel
    Route::get('/messages/general', [MessageController::class, 'generalMessages']);
    Route::post('/messages/general', [MessageController::class, 'sendGeneralMessage']);
    Route::post('/messages/general/{message}/react', [MessageController::class, 'reactToGeneralMessage']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::put('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllRead']);
    Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);

    // Memos
    Route::get('/memos', [MemoController::class, 'index']);
    Route::post('/memos', [MemoController::class, 'store']);
    Route::get('/memos/{memo}', [MemoController::class, 'show']);
    Route::delete('/memos/{memo}', [MemoController::class, 'destroy']);
    Route::post('/memos/{memo}/respond', [MemoController::class, 'respond']);

    // Leave
    Route::get('/leave', [SimpleController::class, 'leaveIndex']);
    Route::post('/leave', [SimpleController::class, 'leaveStore']);
    Route::put('/leave/{leave}/decide', [SimpleController::class, 'leaveDecide']);

    // Bookings
    Route::get('/bookings', [SimpleController::class, 'bookingIndex']);
    Route::post('/bookings', [SimpleController::class, 'bookingStore']);
    Route::put('/bookings/{booking}', [SimpleController::class, 'bookingUpdate']);
    Route::delete('/bookings/{booking}', [SimpleController::class, 'bookingDestroy']);

    // Technical support
    Route::get('/support', [SimpleController::class, 'supportIndex']);
    Route::post('/support', [SimpleController::class, 'supportStore']);
    Route::put('/support/{support}', [SimpleController::class, 'supportUpdate']);

    // Complaints
    Route::get('/complaints', [SimpleController::class, 'complaintIndex']);
    Route::post('/complaints', [SimpleController::class, 'complaintStore']);
    Route::put('/complaints/{complaint}', [SimpleController::class, 'complaintUpdate']);

    // Staff complaints
    Route::get('/staff-complaints', [SimpleController::class, 'staffComplaintIndex']);
    Route::post('/staff-complaints', [SimpleController::class, 'staffComplaintStore']);
    Route::put('/staff-complaints/{complaint}', [SimpleController::class, 'staffComplaintUpdate']);

    // Staff queries
    Route::get('/queries', [SimpleController::class, 'queryIndex']);
    Route::post('/queries', [SimpleController::class, 'queryStore']);
    Route::post('/queries/{staffQuery}/respond', [SimpleController::class, 'queryRespond']);
    Route::delete('/queries/{staffQuery}', [SimpleController::class, 'queryDestroy']);

    // SOPs
    Route::get('/sops', [SimpleController::class, 'sopIndex']);
    Route::post('/sops', [SimpleController::class, 'sopStore']);
    Route::get('/sops/{sop}', [SimpleController::class, 'sopShow']);
    Route::put('/sops/{sop}', [SimpleController::class, 'sopUpdate']);
    Route::delete('/sops/{sop}', [SimpleController::class, 'sopDestroy']);
    Route::post('/sops/{sop}/segments', [SimpleController::class, 'sopSegmentStore']);
    Route::put('/sops/{sop}/segments/{segment}', [SimpleController::class, 'sopSegmentUpdate']);
    Route::delete('/sops/{sop}/segments/{segment}', [SimpleController::class, 'sopSegmentDestroy']);

    // Issue reports
    Route::get('/issues', [SimpleController::class, 'issueIndex']);
    Route::post('/issues', [SimpleController::class, 'issueStore']);
    Route::put('/issues/{issue}', [SimpleController::class, 'issueUpdate']);

    // Review links
    Route::get('/review-links', [SimpleController::class, 'reviewLinkIndex']);
    Route::post('/review-links', [SimpleController::class, 'reviewLinkStore']);
    Route::post('/review-links/{reviewLink}/respond', [SimpleController::class, 'reviewLinkRespond']);
    Route::delete('/review-links/{reviewLink}', [SimpleController::class, 'reviewLinkDestroy']);

    // Notes
    Route::get('/notes', [SimpleController::class, 'noteIndex']);
    Route::post('/notes', [SimpleController::class, 'noteStore']);
    Route::put('/notes/{note}', [SimpleController::class, 'noteUpdate']);
    Route::delete('/notes/{note}', [SimpleController::class, 'noteDestroy']);

    // KPI report
    Route::get('/departments', [\App\Http\Controllers\Api\KpiReportController::class, 'departments']);
    Route::get('/kpi-report/productivity', [\App\Http\Controllers\Api\KpiReportController::class, 'productivity']);
});
