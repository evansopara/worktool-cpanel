<?php

namespace App\Console\Commands;

use App\Services\Attendance;
use Illuminate\Console\Command;

class RunAttendanceCheck extends Command
{
    protected $signature = 'attendance:run';
    protected $description = 'Pick, send and settle the daily attendance check';

    public function handle()
    {
        Attendance::tick();
    }
}
