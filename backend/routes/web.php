<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    abort_unless(is_file(public_path('index.html')), 503, 'The production frontend has not been built.');

    return response()->file(public_path('index.html'), [
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
    ]);
});

Route::get('/{path}', function (Request $request) {
    abort_if(str_starts_with($request->path(), 'api/'), 404);
    abort_unless(is_file(public_path('index.html')), 503, 'The production frontend has not been built.');

    return response()->file(public_path('index.html'), [
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
    ]);
})->where('path', '.*');
