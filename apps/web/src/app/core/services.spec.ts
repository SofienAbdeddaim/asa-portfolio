import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authRefreshInterceptor } from './auth-refresh.interceptor';
import { CommandService } from './command.service';
import { ContentStore, LIVE_URL, SNAPSHOT_URL } from './content.store';
import { ThemeService } from './theme.service';

const snapshot = (generatedAt: string) => ({
  generatedAt,
  profile: null,
  experiences: [],
  skills: [],
  projects: [],
  education: [],
  certificates: [],
  testimonials: [],
  posts: [],
});

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to the system preference and applies it to the root element', () => {
    const theme = TestBed.inject(ThemeService);
    expect(theme.preference()).toBe('system');
    expect(['light', 'dark']).toContain(document.documentElement.getAttribute('data-theme'));
  });

  it('cycles light, dark, system and remembers an explicit choice', () => {
    const theme = TestBed.inject(ThemeService);
    theme.set('light');
    theme.cycle();
    expect(theme.preference()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    theme.cycle();
    expect(theme.preference()).toBe('system');
    expect(localStorage.getItem('theme')).toBeNull();
    theme.cycle();
    expect(theme.preference()).toBe('light');
  });

  it('restores a saved preference', () => {
    localStorage.setItem('theme', 'dark');
    expect(TestBed.inject(ThemeService).resolved()).toBe('dark');
  });

  it('still works when storage is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const theme = TestBed.inject(ThemeService);
    expect(theme.preference()).toBe('system');
    spy.mockRestore();
  });
});

describe('CommandService', () => {
  const run = vi.fn();
  const commands = [
    { id: 'a', label: 'Aller à l’éducation', group: 'Nav', run },
    { id: 'b', label: 'Change theme', keywords: 'dark light', group: 'Look', run },
    { id: 'c', label: 'التبديل إلى العربية', group: 'Lang', run },
  ];

  it('filters accent-insensitively, by keywords, and in Arabic', () => {
    const service = TestBed.inject(CommandService);
    service.register('test', commands);
    expect(service.filter('')).toHaveLength(3);
    expect(service.filter('education').map((c) => c.id)).toEqual(['a']);
    expect(service.filter('DARK').map((c) => c.id)).toEqual(['b']);
    expect(service.filter('العربيه')).toHaveLength(0);
    expect(service.filter('العربية').map((c) => c.id)).toEqual(['c']);
    expect(service.filter('zzz')).toEqual([]);
  });

  it('replaces and removes command sets by source', () => {
    const service = TestBed.inject(CommandService);
    const unregister = service.register('page', [commands[0]!]);
    service.register('page', [commands[1]!]);
    expect(service.commands().map((c) => c.id)).toEqual(['b']);
    unregister();
    expect(service.commands()).toEqual([]);
  });

  it('toggles the open state', () => {
    const service = TestBed.inject(CommandService);
    service.toggle();
    expect(service.open()).toBe(true);
    service.hide();
    expect(service.open()).toBe(false);
    service.show();
    expect(service.open()).toBe(true);
  });
});

describe('ContentStore', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('renders the snapshot first, then upgrades to live data', async () => {
    const store = TestBed.inject(ContentStore);
    const loading = store.load();
    http.expectOne(SNAPSHOT_URL).flush(snapshot('build'));
    await vi.waitFor(() => expect(store.source()).toBe('snapshot'));
    expect(store.content()?.generatedAt).toBe('build');

    http.expectOne(LIVE_URL).flush(snapshot('live'));
    await loading;
    expect(store.source()).toBe('live');
    expect(store.content()?.generatedAt).toBe('live');
  });

  it('keeps the snapshot and reports stale when the API is asleep', async () => {
    const store = TestBed.inject(ContentStore);
    const loading = store.load();
    http.expectOne(SNAPSHOT_URL).flush(snapshot('build'));
    const live = await vi.waitFor(() => http.expectOne(LIVE_URL));
    live.error(new ProgressEvent('error'));
    await loading;
    expect(store.source()).toBe('stale');
    expect(store.content()?.generatedAt).toBe('build');
  });

  it('stays empty when neither source answers, and only loads once', async () => {
    const store = TestBed.inject(ContentStore);
    const loading = store.load();
    http.expectOne(SNAPSHOT_URL).error(new ProgressEvent('error'));
    const live = await vi.waitFor(() => http.expectOne(LIVE_URL));
    live.error(new ProgressEvent('error'));
    await loading;
    expect(store.source()).toBe('empty');
    await store.load();
    http.expectNone(SNAPSHOT_URL);
  });
});

describe('authRefreshInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authRefreshInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
  });

  afterEach(() => http.verify());

  it('refreshes once on 401 and replays the request', () => {
    let result: unknown;
    client.get('/api/admin/projects').subscribe((value) => (result = value));
    http.expectOne('/api/admin/projects').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush({ ok: true });
    http.expectOne('/api/admin/projects').flush(['replayed']);
    expect(result).toEqual(['replayed']);
  });

  it('shares one refresh between concurrent 401s', () => {
    client.get('/api/admin/a').subscribe();
    client.get('/api/admin/b').subscribe();
    http.expectOne('/api/admin/a').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/admin/b').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush({ ok: true });
    http.expectOne('/api/admin/a').flush([]);
    http.expectOne('/api/admin/b').flush([]);
  });

  it('gives up when the refresh itself fails', () => {
    let status = 0;
    client.get('/api/admin/projects').subscribe({ error: (error) => (status = error.status) });
    http.expectOne('/api/admin/projects').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(status).toBe(401);
  });

  it('never retries auth endpoints, non-401 errors or non-API calls', () => {
    const statuses: number[] = [];
    const record = { error: (error: { status: number }) => statuses.push(error.status) };
    client.post('/api/auth/login', {}).subscribe(record);
    client.get('/api/projects').subscribe(record);
    client.get('/other').subscribe(record);
    http.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/projects').flush(null, { status: 500, statusText: 'Server Error' });
    http.expectOne('/other').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(statuses).toEqual([401, 500, 401]);
    http.expectNone('/api/auth/refresh');
  });
});
