<?php

namespace App\Http\Controllers;

use App\Services\ErpResourceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResourceController extends Controller
{
    public function __construct(private readonly ErpResourceService $resources)
    {
    }

    public function index(Request $request, string $resource): JsonResponse
    {
        return response()->json($this->resources->list($resource, $request->user(), $request->query()));
    }

    public function store(Request $request, string $resource): JsonResponse
    {
        return response()->json([
            'data' => $this->resources->store($resource, $request->user(), $request->all()),
        ], Response::HTTP_CREATED);
    }

    public function update(Request $request, string $resource, int $id): JsonResponse
    {
        return response()->json([
            'data' => $this->resources->update(
                $resource,
                $this->resources->findModel($resource, $id),
                $request->user(),
                $request->all(),
            ),
        ]);
    }

    public function destroy(Request $request, string $resource, int $id): Response
    {
        $this->resources->archive(
            $resource,
            $this->resources->findModel($resource, $id),
            $request->user(),
        );

        return response()->noContent();
    }

    public function restore(Request $request, string $resource, int $id): JsonResponse
    {
        return response()->json(['data' => $this->resources->restore($resource, $id, $request->user())]);
    }
}
