<?php

namespace App\Notifications\Providers;

use App\Contracts\NotificationProviderInterface;
use App\Models\NotificationLog;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class SmsNotificationProvider implements NotificationProviderInterface
{
    public function send(NotificationLog $notification): array
    {
        $url = config('services.sms.url');
        $token = config('services.sms.token');
        if (!$url || !$token) {
            throw new RuntimeException('SMS provider credentials are not configured.');
        }

        $response = Http::withToken($token)->timeout(20)->post($url, [
            'to' => $notification->recipient_contact,
            'message' => $notification->message_body,
            'sender_id' => config('services.sms.sender_id'),
        ])->throw()->json();

        return [
            'message_id' => (string) ($response['message_id'] ?? $response['id'] ?? ''),
            'status' => 'sent',
            'payload' => $response,
        ];
    }
}
