<?php

namespace App\Jobs;

use App\Models\NotificationLog;
use App\Services\NotificationProviderFactory;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class SendExpiryNotification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var array<int> */
    public array $backoff = [60, 300, 900];

    public function __construct(public readonly int $notificationLogId)
    {
    }

    public function handle(NotificationProviderFactory $factory): void
    {
        $notification = NotificationLog::query()->find($this->notificationLogId);
        if (!$notification || in_array($notification->status, ['sent', 'delivered', 'cancelled'], true)) {
            return;
        }

        $notification->update([
            'status' => 'processing',
            'failure_reason' => null,
        ]);

        try {
            $provider = $factory->make($notification->channel, $notification->company_id);
            $result = $provider->send($notification);
            $notification->update([
                'provider' => class_basename($provider),
                'provider_message_id' => $result['message_id'] ?? null,
                'provider_payload' => $result['payload'] ?? null,
                'status' => $result['status'] ?? 'sent',
                'sent_at' => now('Asia/Qatar'),
                'delivered_at' => ($result['status'] ?? null) === 'delivered' ? now('Asia/Qatar') : null,
            ]);
        } catch (Throwable $exception) {
            $notification->update([
                'status' => 'failed',
                'failure_reason' => mb_substr($exception->getMessage(), 0, 2000),
                'retry_count' => $notification->retry_count + 1,
            ]);

            throw $exception;
        }
    }
}
