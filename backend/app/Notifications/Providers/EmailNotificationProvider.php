<?php

namespace App\Notifications\Providers;

use App\Contracts\NotificationProviderInterface;
use App\Models\NotificationLog;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class EmailNotificationProvider implements NotificationProviderInterface
{
    public function send(NotificationLog $notification): array
    {
        Mail::raw($notification->message_body, function ($message) use ($notification) {
            $message->to($notification->recipient_contact)
                ->subject($notification->email_subject ?: 'Trust Group document expiry reminder');
        });

        return ['message_id' => 'mail-'.Str::uuid(), 'status' => 'sent'];
    }
}
