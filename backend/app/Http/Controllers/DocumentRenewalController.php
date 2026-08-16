<?php

namespace App\Http\Controllers;

use App\Services\DocumentRenewalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentRenewalController extends Controller
{
    public function __construct(private readonly DocumentRenewalService $renewals)
    {
    }

    public function store(Request $request, int $document): JsonResponse
    {
        return response()->json([
            'data' => $this->renewals->renew($document, $request->user(), $request->all()),
        ], 201);
    }
}
