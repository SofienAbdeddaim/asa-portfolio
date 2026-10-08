import { HttpErrorResponse } from '@angular/common/http';

/** A readable, non-technical message for a failed API call. Never exposes raw exception text. */
export function apiMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return 'Something went wrong. Try again.';
  const body = error.error as { message?: unknown } | null;
  const detail = body?.message;

  switch (error.status) {
    case 0:
      return "Can't reach the server. Check your connection and try again.";
    case 400:
      if (Array.isArray(detail)) return detail.map(String).join(' · ');
      return typeof detail === 'string' ? detail : 'Some fields are not valid.';
    case 401:
      return 'Your session expired. Sign in again.';
    case 403:
      return 'That request was blocked.';
    case 404:
      return "That item doesn't exist any more.";
    case 409:
      return typeof detail === 'string' ? detail : 'That conflicts with an existing item.';
    case 413:
      return 'That file is too large (5 MB maximum).';
    case 429:
      return 'Too many attempts. Wait a minute and try again.';
    default:
      return error.status >= 500
        ? 'The server had a problem. Try again in a moment.'
        : 'Something went wrong. Try again.';
  }
}
