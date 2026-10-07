import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import type { ContentSnapshot } from '@asa/shared';
import { firstValueFrom, timeout } from 'rxjs';

/** `snapshot`: build-time copy only; `live`: refreshed from the API; `stale`: API unreachable. */
export type ContentSource = 'empty' | 'snapshot' | 'live' | 'stale';

export const SNAPSHOT_URL = '/content-snapshot.json';
export const LIVE_URL = '/api/content';
const LIVE_TIMEOUT_MS = 5000;

/**
 * Public content. It always renders from the build-time snapshot first, then upgrades to live data
 * when the API answers. A sleeping free-tier API therefore never blocks or blanks the page.
 */
@Injectable({ providedIn: 'root' })
export class ContentStore {
  private readonly http = inject(HttpClient);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly _content = signal<ContentSnapshot | null>(null);
  private readonly _source = signal<ContentSource>('empty');
  readonly content = this._content.asReadonly();
  readonly source = this._source.asReadonly();

  private started = false;

  async load(): Promise<void> {
    if (this.started) return;
    this.started = true;

    try {
      this._content.set(await firstValueFrom(this.http.get<ContentSnapshot>(SNAPSHOT_URL)));
      this._source.set('snapshot');
    } catch {
      // No snapshot (e.g. first local run): fall through to the live request.
    }
    if (!this.browser) return; // prerendering must not depend on the API being awake

    try {
      const live = await firstValueFrom(
        this.http.get<ContentSnapshot>(LIVE_URL).pipe(timeout(LIVE_TIMEOUT_MS)),
      );
      this._content.set(live);
      this._source.set('live');
    } catch {
      this._source.set(this._content() ? 'stale' : 'empty');
    }
  }
}
