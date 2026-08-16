<?php

namespace App\Notifications\Providers;

use App\Contracts\NotificationProviderInterface;
use App\Models\NotificationLog;
use Illuminate\Support\Str;

class FakeNotificationProvider implements NotificationProviderInterface
{
    public function send(NotificationLog $notification): array
    {
        return [
            'message_id' => 'mock-'.Str::uuid(),
            'status' => 'sent',
            'payload' => [
                'simulated' => true,
                'channel' => $notification->channel,
                'recipient' => $notification->recipient_contact,
                'message' => $notification->message_body,
            ],
        ];
    }
}
