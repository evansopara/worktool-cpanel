<?php

use Illuminate\Support\Facades\Route;

Route::fallback(function () {
    $requestPath = trim(request()->path(), '/');

    $candidates = [
        public_path($requestPath . '.html'),
        public_path($requestPath . '/index.html'),
        public_path('index.html'),
    ];

    foreach ($candidates as $path) {
        if (file_exists($path)) {
            return response(file_get_contents($path), 200)
                ->header('Content-Type', 'text/html');
        }
    }

    $notFound = public_path('404.html');
    if (file_exists($notFound)) {
        return response(file_get_contents($notFound), 404)
            ->header('Content-Type', 'text/html');
    }

    return response('Not found', 404);
});
