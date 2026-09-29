<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Operations Manager (admin)
        User::create([
            'username' => 'admin',
            'first_name' => 'Admin',
            'last_name' => 'User',
            'password' => Hash::make('password'),
            'role' => 'operations_manager',
            'status' => 'active',
            'must_set_password' => false,
        ]);

        // Team Lead
        User::create([
            'username' => 'teamlead',
            'first_name' => 'Team',
            'last_name' => 'Lead',
            'password' => Hash::make('password'),
            'role' => 'team_lead',
            'status' => 'active',
            'must_set_password' => false,
        ]);

        // Project Manager
        User::create([
            'username' => 'pm',
            'first_name' => 'Project',
            'last_name' => 'Manager',
            'password' => Hash::make('password'),
            'role' => 'project_manager',
            'status' => 'active',
            'must_set_password' => false,
        ]);

        // Staff
        User::create([
            'username' => 'staff',
            'first_name' => 'Staff',
            'last_name' => 'Member',
            'password' => Hash::make('password'),
            'role' => 'staff',
            'specialization' => 'developer',
            'status' => 'active',
            'must_set_password' => false,
        ]);

        // Client
        User::create([
            'username' => 'client',
            'first_name' => 'Client',
            'last_name' => 'User',
            'password' => Hash::make('password'),
            'role' => 'client',
            'status' => 'active',
            'must_set_password' => false,
        ]);
    }
}
