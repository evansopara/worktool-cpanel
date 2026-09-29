<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\AppNotification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required',
        ]);

        $user = User::where('username', $request->username)->first();

        if (!$user || !$user->password || !$this->verifyPassword($request->password, $user)) {
            throw ValidationException::withMessages([
                'username' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (!$user->is_active) {
            return response()->json(['message' => 'This account has been deactivated. Please contact an administrator.'], 403);
        }

        if ($user->status === 'inactive') {
            return response()->json(['message' => 'Account is inactive.'], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user,
        ]);
    }

    /**
     * Verify a password against a user's stored hash.
     * Supports both bcrypt (Laravel) and legacy scrypt (Replit) formats.
     * On successful legacy login, transparently re-hashes to bcrypt.
     */
    private function verifyPassword(string $plain, User $user): bool
    {
        $stored = $user->password;

        // Bcrypt — Laravel's default. $2y$, $2a$, $2b$ all valid.
        if (preg_match('/^\$2[ayb]\$/', $stored)) {
            return Hash::check($plain, $stored);
        }

        // Legacy scrypt format from Replit: "hexhash.hexsalt"
        if (str_contains($stored, '.')) {
            [$hashHex, $saltHex] = explode('.', $stored, 2);

            // Validate both halves are hex
            if (!ctype_xdigit($hashHex) || !ctype_xdigit($saltHex)) {
                return false;
            }

            $salt = hex2bin($saltHex);
            $expected = hex2bin($hashHex);

            // Replit's auth-helpers default: scrypt N=16384, r=8, p=1, dkLen=64
            $derived = @scrypt(
                $plain,
                $salt,
                16384,  // N - CPU/memory cost
                8,      // r - block size
                1,      // p - parallelization
                64      // dkLen - output length in bytes
            );

            // Fallback: if PHP's scrypt() isn't available, use libsodium
            if ($derived === false || $derived === null) {
                $derived = $this->scryptFallback($plain, $salt, 64);
            }

            if ($derived === null || !hash_equals($expected, $derived)) {
                return false;
            }

            // Successful legacy login — upgrade to bcrypt for next time
            $user->password = Hash::make($plain);
            $user->save();

            return true;
        }

        return false;
    }

    /**
     * Pure-PHP scrypt fallback using sodium when ext-scrypt isn't installed.
     * Matches scrypt(N=16384, r=8, p=1) used by Node's crypto.scryptSync.
     */
    private function scryptFallback(string $password, string $salt, int $length): ?string
    {
        // PHP doesn't ship a pure-PHP scrypt implementation. Use shell exec
        // of openssl as a last-resort. Most servers have openssl 1.1+.
        $passEsc = base64_encode($password);
        $saltEsc = base64_encode($salt);
        $cmd = sprintf(
            'php -r %s',
            escapeshellarg(
                "echo bin2hex(scrypt(base64_decode('$passEsc'), base64_decode('$saltEsc'), 16384, 8, 1, $length));"
            )
        );
        $out = @shell_exec($cmd);
        if ($out === null || $out === '' || !ctype_xdigit(trim($out))) {
            return null;
        }
        return hex2bin(trim($out));
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'first_name' => 'sometimes|string|max:100',
            'last_name' => 'sometimes|string|max:100',
            'phone' => 'sometimes|nullable|string',
            'profile_picture' => 'sometimes|nullable|string',
        ]);

        $user->update($data);
        return response()->json($user);
    }

    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required',
            'password' => 'required|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!$this->verifyPassword($request->current_password, $user)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $user->update([
            'password' => Hash::make($request->password),
            'must_set_password' => false,
        ]);

        return response()->json(['message' => 'Password updated successfully.']);
    }

    public function setupPassword(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
            'password' => 'required|min:8|confirmed',
        ]);

        // Tokens are stored hashed; a leaked database cannot be replayed.
        $user = User::where('password_setup_token', hash('sha256', $request->token))->first();

        if (!$user || !$user->reset_password_expires || now()->greaterThan($user->reset_password_expires)) {
            return response()->json(['message' => 'Invalid or expired token.'], 422);
        }

        $user->update([
            'password' => Hash::make($request->password),
            'must_set_password' => false,
            'password_setup_token' => null,
            'reset_password_expires' => null,
            'status' => 'active',
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user,
        ]);
    }

    /**
     * Self-service: a user submits their username and, if it matches an
     * account with an email on file, gets sent a "set up password" link.
     * Always responds with the same generic message so usernames can't be
     * enumerated by watching for a different response.
     */
    public function forgotPassword(Request $request)
    {
        $request->validate(['username' => 'required|string']);

        $user = User::where('username', $request->username)->first();

        if ($user) {
            $token = \Str::random(40);
            $user->update([
                'password_setup_token' => hash('sha256', $token),
                'reset_password_expires' => now()->addMinutes(60),
                'must_set_password' => true,
            ]);

            $this->sendSetupPasswordEmail(
                $user,
                $token,
                'Reset Your Password',
                'You requested a password reset. Use the link below to set a new password.',
            );
        }

        return response()->json([
            'message' => 'If that username exists, a password setup link has been sent to the associated email address.',
        ]);
    }

    // Admin: list all users
    // public function users(Request $request)
    // {
    //     //$this->authorizeRole($request, ['operations_manager']);
    //     $users = User::orderBy('created_at', 'desc')->get();
    //     return response()->json($users);
    // }

    public function users(Request $request)
    {
        // Anyone authenticated can list users — needed for assignment dropdowns,
        // memo recipients, mentions, etc. Sensitive fields are hidden by the
        // User model's $hidden array. Deactivated users are excluded here so
        // they stay invisible everywhere this endpoint is used, EXCEPT for
        // admin/team-lead management screens, which opt in with ?all=1 so
        // they can still see and reactivate deactivated accounts.
        $query = User::query();

        $wantsAll = $request->boolean('all')
            && in_array($request->user()->role, ['operations_manager', 'team_lead']);

        if (!$wantsAll) {
            $query->where('is_active', 1);
        }

        $users = $query->orderBy('first_name', 'asc')->get();
        return response()->json($users);
    }

    // Admin: create user
    public function createUser(Request $request)
    {
        $this->authorizeRole($request, ['operations_manager']);

        $data = $request->validate([
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'username' => 'required|string|unique:users',
            'email' => 'required|email|unique:users',
            'role' => 'required|string',
            'specialization' => 'nullable|string',
            'department' => 'nullable|string',
            'phone' => 'nullable|string',
        ]);

        $token = \Str::random(40);
        $data['password'] = Hash::make(\Str::random(16));
        $data['must_set_password'] = true;
        $data['password_setup_token'] = hash('sha256', $token);
        $data['reset_password_expires'] = now()->addDays(7);
        $data['status'] = 'pending';

        $user = User::create($data);

        $this->sendSetupPasswordEmail(
            $user,
            $token,
            'Welcome to ' . config('app.name'),
            "An account has been created for you by {$request->user()->name}. Set up your password to get started.",
        );

        return response()->json(['user' => $user, 'setup_token' => $token], 201);
    }

    // Admin: update user
    public function updateUser(Request $request, User $user)
    {
        $this->authorizeRole($request, ['operations_manager']);

        $data = $request->validate([
            'first_name' => 'sometimes|string',
            'last_name' => 'sometimes|string',
            'email' => 'sometimes|nullable|email|unique:users,email,' . $user->id,
            'role' => 'sometimes|string',
            'specialization' => 'nullable|string',
            'department' => 'nullable|string',
            'status' => 'sometimes|string',
            'phone' => 'nullable|string',
        ]);

        $user->update($data);
        return response()->json($user);
    }

    // Admin: generate password reset token for a user
    public function resetPasswordToken(Request $request, User $user)
    {
        $this->authorizeRole($request, ['operations_manager']);

        $token = \Str::random(40);
        $user->update([
            'password_setup_token' => hash('sha256', $token),
            'reset_password_expires' => now()->addHours(72),
            'must_set_password' => true,
        ]);

        $this->sendSetupPasswordEmail(
            $user,
            $token,
            'Your Password Was Reset',
            "An administrator reset your password. Set up a new password to regain access to your account.",
        );

        return response()->json(['setup_token' => $token]);
    }

    // Admin: delete user
    public function deleteUser(Request $request, User $user)
    {
        $this->authorizeRole($request, ['operations_manager']);
        $user->delete();
        return response()->json(['message' => 'User deleted.']);
    }

    // Deactivate a user: blocks future logins and immediately revokes their
    // active sessions. Team Lead accounts are protected from deactivation.
    public function deactivateUser(Request $request, User $user)
    {
        $this->authorizeRole($request, ['operations_manager', 'team_lead']);

        if ($user->role === 'team_lead') {
            abort(403, 'Team Lead accounts cannot be deactivated.');
        }

        $user->update(['is_active' => false]);
        $user->tokens()->delete();

        return response()->json($user);
    }

    // Reactivate a previously deactivated user, restoring full access.
    public function activateUser(Request $request, User $user)
    {
        $this->authorizeRole($request, ['operations_manager', 'team_lead']);

        $user->update(['is_active' => true]);

        return response()->json($user);
    }

    private function authorizeRole(Request $request, array $roles)
    {
        if (!in_array($request->user()->role, $roles)) {
            abort(403, 'Unauthorized');
        }
    }

    /**
     * Email a user a link to set/reset their password. Wrapped so a mail
     * failure never breaks account creation or the reset-token response.
     */
    private function sendSetupPasswordEmail(User $user, string $token, string $title, string $message): void
    {
        if (empty($user->email) || !$user->is_active) {
            return;
        }

        try {
            $setupUrl = rtrim(env('FRONTEND_URL', config('app.url')), '/') . '/setup-password?token=' . $token;
            Mail::to($user->email)->send(new AppNotification($title, $message, $setupUrl, 'Set Up Password'));
        } catch (\Throwable $e) {
            Log::warning("Setup-password email failed for user {$user->id}: " . $e->getMessage());
        }
    }
}