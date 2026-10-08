import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { AdminApi, type AdminUser } from './admin-api';

/** Who is signed in. The session itself lives in httpOnly cookies the browser manages. */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(AdminApi);

  private readonly _user = signal<AdminUser | null>(null);
  readonly user = this._user.asReadonly();

  /**
   * True when a valid session exists. An expired access token is renewed once with the refresh
   * cookie before giving up, so a returning admin is not asked to sign in again needlessly.
   */
  async ensure(): Promise<boolean> {
    if (this._user()) return true;
    try {
      this._user.set(await this.api.me());
      return true;
    } catch (error) {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) return false;
    }
    try {
      await this.api.refresh();
      this._user.set(await this.api.me());
      return true;
    } catch {
      return false;
    }
  }

  /** Called after a completed sign-in. */
  async signedIn(): Promise<void> {
    this._user.set(await this.api.me());
  }

  async signOut(): Promise<void> {
    try {
      await this.api.logout();
    } finally {
      this._user.set(null);
    }
  }

  /** The server rejected the session (for example after a failed refresh). */
  expire(): void {
    this._user.set(null);
  }
}
