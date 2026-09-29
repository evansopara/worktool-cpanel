<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Headers;
use Illuminate\Queue\SerializesModels;

class AppNotification extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $notifTitle,
        public string $notifMessage,
        public ?string $actionUrl = null,
        public string $actionLabel = 'Open App',
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->notifTitle,
            replyTo: [config('mail.from.address')],
        );
    }

    public function headers(): Headers
    {
        return new Headers(
            text: [
                'X-Mailer'         => config('app.name') . ' Mailer',
                'X-Priority'       => '3',
                'Precedence'       => 'bulk',
                'List-Unsubscribe' => '<mailto:' . config('mail.from.address') . '>',
            ],
        );
    }

    public function content(): Content
    {
        return new Content(
            view:     'emails.notification',
            text:     'emails.notification-text',
        );
    }
}
