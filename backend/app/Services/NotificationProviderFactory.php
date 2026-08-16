<?php

namespace App\Services;

use App\Contracts\NotificationProviderInterface;
use App\Models\SystemSetting;
use App\Notifications\Providers\EmailNotificationProvider;
use App\Notifications\Providers\FakeNotificationProvider;
use App\Notifications\Providers\SmsNotificationProvider;
use App\Notifications\Providers\WhatsAppNotificationProvider;
use InvalidArgumentException;

class NotificationProviderFactory
{
    public function make(string $channel, ?int $companyId = null): NotificationProviderInterface
    {
        $global = SystemSetting::query()
            ->whereNull('company_id')
            ->where('key', 'application')
            ->first()?->value ?? [];
        $company = $companyId
            ? SystemSetting::query()->where('company_id', $companyId)->where('key', 'application')->first()?->value
            : [];
        $settings = array_replace_recursive($global, $company ?? []);
        $provider = $settings['providerConfig'] ?? $settings;

        $enabledKey = match ($channel) {
            'email' => 'emailEnabled',
            'sms' => 'smsEnabled',
            'whatsapp' => 'whatsappEnabled',
            default => throw new InvalidArgumentException("Unsupported notification channel: {$channel}"),
        };
        if (($provider[$enabledKey] ?? false) !== true) {
            throw new InvalidArgumentException(ucfirst($channel).' notifications are disabled.');
        }

        if (($provider['mockMode'] ?? true) === true) {
            return app(FakeNotificationProvider::class);
        }

        return match ($channel) {
            'email' => app(EmailNotificationProvider::class),
            'sms' => app(SmsNotificationProvider::class),
            'whatsapp' => app(WhatsAppNotificationProvider::class),
            default => throw new InvalidArgumentException("Unsupported notification channel: {$channel}"),
        };
    }
}
