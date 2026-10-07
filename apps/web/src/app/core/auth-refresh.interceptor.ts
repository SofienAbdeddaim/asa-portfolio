import { HttpClient, HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';

const API = '/api/';
const AUTH = '/api/auth/';

let refreshing: Observable<unknown> | null = null;

/**
 * On a 401 from a protected API call, refreshes the session once (shared by concurrent requests)
 * and replays the original request. Auth endpoints themselves are never retried. Sessions live in
 * httpOnly cookies, so there is no token handling here.
 */
export const authRefreshInterceptor: HttpInterceptorFn = (request, next) => {
  const http = inject(HttpClient);
  const isApi = request.url.startsWith(API);
  const isAuth = request.url.startsWith(AUTH);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!isApi || isAuth || !(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      refreshing ??= http.post('/api/auth/refresh', {}).pipe(
        shareReplay(1),
        finalize(() => (refreshing = null)),
      );
      return refreshing.pipe(switchMap(() => next(request)));
    }),
  );
};
