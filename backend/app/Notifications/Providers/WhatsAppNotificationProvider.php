<?php

namespace App\Notifications\Providers;

use App\Contracts\NotificationProviderInterface;
use App\Models\NotificationLog;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class WhatsAppNotificationProvider implements NotificationProviderInterface
{
    public function send(NotificationLog $notification): array
    {
        $phoneId = config('services.whatsapp.phone_number_id');
        $token = config('services.whatsapp.token');
        if (!$phoneId || !$token) {
            throw new RuntimeException('WhatsApp provider credentials are not configured.');
        }

        $response = Http::withToken($token)
            ->timeout(20)
            ->post("https://graph.facebook.com/v23.0/{$phoneId}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $notification->recipient_contact,
                'type' => 'text',
                'text' => ['body' => $notification->message_body],
            ])->throw()->json();

        return [
            'message_id' => (string) data_get($response, 'messages.0.id', ''),
            'status' => 'sent',
            'payload' => $response,
        ];
    }
}
