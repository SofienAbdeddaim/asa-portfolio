import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Injectable,
  PLATFORM_ID,
  TransferState,
  computed,
  inject,
  makeStateKey,
  signal,
} from '@angular/core';
import type { ContentSnapshot } from '@asa/shared';
import { firstValueFrom, timeout } from 'rxjs';

/** `snapshot`: build-time copy only; `live`: refreshed from the API; `stale`: API unreachable. */
export type ContentSource = 'empty' | 'snapshot' | 'live' | 'stale';

export const SNAPSHOT_URL = '/content-snapshot.json';
export const LIVE_URL = '/api/content';
const LIVE_TIMEOUT_MS = 5000;
const SNAPSHOT_KEY = makeStateKey<ContentSnapshot>('content-snapshot');

/**
 * Public content. It always renders from the build-time snapshot first, then upgrades to live data
 * when the API answers. A sleeping free-tier API therefore never blocks or blanks the page.
 *
 * At prerender time the snapshot is read from disk (see `app.config.server.ts`), rendered into the
 * HTML and handed to the browser through TransferState, so hydration needs no extra request.
 *
 * Pages that only need content to render (titles, blog posts) wait for `ensureSnapshot()`, which
 * never touches the API; `load()` additionally refreshes from the API in the browser.
 */
@Injectable({ providedIn: 'root' })
export class ContentStore {
  private readonly http = inject(HttpClient);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly transfer = inject(TransferState);

  private readonly _content = signal<ContentSnapshot | null>(null);
  private readonly _source = signal<ContentSource>('empty');
  readonly content = this._content.asReadonly();
  readonly source = this._source.asReadonly();

  readonly profile = computed(() => this._content()?.profile ?? null);
  /** Published posts, newest first (the API already sorts them). */
  readonly posts = computed(() => this._content()?.posts ?? []);

  private snapshotLoad?: Promise<void>;
  private started = false;

  constructor() {
    const transferred = this.transfer.get(SNAPSHOT_KEY, null);
    if (transferred) {
      this.transfer.remove(SNAPSHOT_KEY);
      this._content.set(transferred);
      this._source.set('snapshot');
    }
  }

  /** Server only: installs the snapshot read at build time and passes it on to the browser. */
  seed(snapshot: ContentSnapshot): void {
    this._content.set(snapshot);
    this._source.set('snapshot');
    this.transfer.set(SNAPSHOT_KEY, snapshot);
  }

  /** Makes sure the build-time snapshot is loaded (once). Never waits for the API. */
  ensureSnapshot(): Promise<void> {
    this.snapshotLoad ??= this.loadSnapshot();
    return this.snapshotLoad;
  }

  private async loadSnapshot(): Promise<void> {
    if (this._content()) return;
    try {
      this._content.set(await firstValueFrom(this.http.get<ContentSnapshot>(SNAPSHOT_URL)));
      this._source.set('snapshot');
    } catch {
      // No snapshot (e.g. first local run): the live request below may still succeed.
    }
  }

  /** Snapshot first, then (in the browser only) a refresh from the API. */
  async load(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.ensureSnapshot();
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
