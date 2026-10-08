import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type { Entity } from './resources';

export interface AdminUser {
  id: string;
  email: string;
}

export interface LoginResult {
  challenge: string;
  mfaEnrolled: boolean;
}

export interface Enrollment {
  otpauthUrl: string;
  qrDataUrl: string;
  secret: string;
}

export interface UploadedImage {
  id: string;
  url: string;
  bytes: number;
  width: number;
  height: number;
}

const call = <T>(request: Observable<T>): Promise<T> => firstValueFrom(request);

/** Every request the back-office makes. Sessions are httpOnly cookies, so nothing is stored here. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  // ---- authentication ------------------------------------------------------------------------
  me = () => call(this.http.get<AdminUser>('/api/auth/me'));
  refresh = () => call(this.http.post('/api/auth/refresh', {}));
  login = (email: string, password: string) =>
    call(this.http.post<LoginResult>('/api/auth/login', { email, password }));
  beginEnrollment = (challenge: string) =>
    call(this.http.post<Enrollment>('/api/auth/2fa/setup', { challenge }));
  enable = (challenge: string, code: string) =>
    call(this.http.post<{ recoveryCodes: string[] }>('/api/auth/2fa/enable', { challenge, code }));
  verify = (challenge: string, proof: { code: string } | { recoveryCode: string }) =>
    call(this.http.post<{ ok: boolean }>('/api/auth/2fa/verify', { challenge, ...proof }));
  logout = () => call(this.http.post('/api/auth/logout', {}));

  // ---- content -------------------------------------------------------------------------------
  list = (path: string) => call(this.http.get<Entity[]>(`/api/admin/${path}`));
  get = (path: string, id: string) => call(this.http.get<Entity>(`/api/admin/${path}/${id}`));
  create = (path: string, body: Record<string, unknown>) =>
    call(this.http.post<Entity>(`/api/admin/${path}`, body));
  update = (path: string, id: string, body: Record<string, unknown>) =>
    call(this.http.patch<Entity>(`/api/admin/${path}/${id}`, body));
  remove = (path: string, id: string) => call(this.http.delete(`/api/admin/${path}/${id}`));
  reorder = (path: string, ids: string[]) =>
    call(this.http.put(`/api/admin/${path}/reorder`, { ids }));

  /** The profile is a single document: `null` until it is first saved. */
  getProfile = () => call(this.http.get<Entity | null>('/api/admin/profile'));
  saveProfile = (body: Record<string, unknown>) =>
    call(this.http.put<Entity>('/api/admin/profile', body));

  // ---- media ---------------------------------------------------------------------------------
  upload(file: File): Promise<UploadedImage> {
    const body = new FormData();
    body.append('file', file);
    return call(this.http.post<UploadedImage>('/api/admin/media', body));
  }
}
