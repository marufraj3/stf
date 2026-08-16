<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        if (
            $request->user()?->force_password_change
            && !$request->user()?->currentAccessToken()?->can('impersonated')
        ) {
            return new JsonResponse([
                'message' => 'You must replace the temporary password before using the ERP.',
                'code' => 'PASSWORD_CHANGE_REQUIRED',
            ], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
