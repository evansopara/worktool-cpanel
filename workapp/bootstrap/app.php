<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);

        // cPanel serves PHP directly (no load balancer), so no proxy is trusted.
        // Trusting '*' here would let any client spoof its IP, host and scheme
        // via X-Forwarded-* headers. If you later put Cloudflare in front of the
        // site, trust only Cloudflare's published IP ranges, e.g.:
        //   $middleware->trustProxies(at: ['173.245.48.0/20', '103.21.244.0/22', /* ... */],
        //       headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_PROTO);

        // For unauthenticated API requests, return JSON 401 instead of redirecting to a 'login' route
        $middleware->redirectGuestsTo(fn (Request $request) =>
            $request->expectsJson() || $request->is('api/*')
                ? null
                : '/auth'
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Return JSON for API exceptions
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
            return null;
        });
    })->create();
