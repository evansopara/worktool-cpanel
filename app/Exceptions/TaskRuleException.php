<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * A task rule refused the action (design/HANDOFF_SPEC.md §8). `code` tells
 * the UI what to do next, e.g. confirm_read → show the instructions sheet,
 * confirm_early → show the early-start prompt with `extra.clash`.
 */
class TaskRuleException extends RuntimeException
{
    public function __construct(
        public readonly string $rule,
        string $message,
        public readonly int $status = 422,
        public readonly array $extra = [],
    ) {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage(), 'code' => $this->rule] + $this->extra, $this->status);
    }
}
