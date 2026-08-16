<?php

namespace App\Contracts;

use App\Models\NotificationLog;

interface NotificationProviderInterface
{
    /** @return array{message_id: string|null, status: string, payload?: array} */
    public function send(NotificationLog $notification): array;
}
