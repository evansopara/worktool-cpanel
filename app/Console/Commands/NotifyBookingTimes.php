<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class NotifyBookingTimes extends Command
{
    protected $signature = 'bookings:notify';
    protected $description = 'Notify meeting participants when a booking starts and ends';

    public function handle()
    {
        $starting = Booking::where('start_notified', false)
            ->whereNotNull('start_time')
            ->where('start_time', '<=', now())
            ->get();

        foreach ($starting as $booking) {
            $this->notifyParticipants($booking, 'meeting_started', 'Meeting Started', "\"{$booking->title}\" has started.");
            $booking->update(['start_notified' => true]);
        }

        $ending = Booking::where('end_notified', false)
            ->whereNotNull('end_time')
            ->where('end_time', '<=', now())
            ->get();

        foreach ($ending as $booking) {
            $this->notifyParticipants($booking, 'meeting_ended', 'Meeting Ended', "\"{$booking->title}\" has ended.");
            $booking->update(['end_notified' => true]);
        }

        $this->info('Notified ' . $starting->count() . ' starting and ' . $ending->count() . ' ending booking(s).');
        return 0;
    }

    private function notifyParticipants(Booking $booking, string $type, string $title, string $message): void
    {
        $recipientIds = collect($booking->participants ?? [])->push($booking->scheduled_by)->unique();

        foreach ($recipientIds as $userId) {
            NotificationService::send($userId, $type, $title, $message, $booking->id, 'booking');
        }
    }
}
