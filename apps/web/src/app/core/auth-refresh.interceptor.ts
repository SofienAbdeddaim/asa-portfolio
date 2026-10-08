import { HttpClient, HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';

const API = '/api/';
const AUTH = '/api/auth/';
const LOGIN_URL = '/admin/login';

let refreshing: Observable<unknown> | null = null;

/**
 * On a 401 from a protected API call, refreshes the session once (shared by concurrent requests)
 * and replays the original request. If the refresh itself is refused the session is over, so the
 * user is sent to the sign-in page. Auth endpoints are never retried. Sessions live in httpOnly
 * cookies, so there is no token handling here.
 */
export const authRefreshInterceptor: HttpInterceptorFn = (request, next) => {
  const http = inject(HttpClient);
  const router = inject(Router);
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
      return refreshing.pipe(
        catchError((refreshError: unknown) => {
          void router.navigateByUrl(LOGIN_URL).catch(() => undefined);
          return throwError(() => refreshError);
        }),
        switchMap(() => next(request)),
      );
    }),
  );
};
