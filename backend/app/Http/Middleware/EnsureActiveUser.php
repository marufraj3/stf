<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user || $user->status !== 'active') {
            $user?->currentAccessToken()?->delete();
            abort(401, 'This account is inactive.');
        }

        return $next($request);
    }
}
