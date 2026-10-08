import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import {
  Router,
  provideRouter,
  UrlTree,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import { byText, fakeAdminApi, httpError, settle, typeInto } from '../../testing/admin-helpers';
import { provideI18n } from '../core/i18n';
import { AdminApi } from './admin-api';
import { AuthStore } from './auth.store';
import { adminAreaGuard, adminGuard, guestGuard, unsavedChangesGuard } from './guards';
import { LoginPage } from './login.page';

const runGuard = <T>(guard: unknown) =>
  TestBed.runInInjectionContext(() =>
    (guard as (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => T)(
      {} as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    ),
  );

describe('AuthStore', () => {
  function setup() {
    const api = fakeAdminApi();
    TestBed.configureTestingModule({ providers: [{ provide: AdminApi, useValue: api }] });
    return { api, store: TestBed.inject(AuthStore) };
  }

  it('recognizes a valid session once and remembers it', async () => {
    const { api, store } = setup();
    api['me']!.mockResolvedValue({ id: '1', email: 'a@example.com' });
    expect(await store.ensure()).toBe(true);
    expect(await store.ensure()).toBe(true);
    expect(api['me']).toHaveBeenCalledTimes(1);
    expect(store.user()?.email).toBe('a@example.com');
  });

  it('renews an expired access token with the refresh cookie before giving up', async () => {
    const { api, store } = setup();
    api['me']!.mockRejectedValueOnce(httpError(401)).mockResolvedValueOnce({
      id: '1',
      email: 'a@example.com',
    });
    expect(await store.ensure()).toBe(true);
    expect(api['refresh']).toHaveBeenCalledOnce();
  });

  it('is signed out when the refresh is refused, or the server is unreachable', async () => {
    const first = setup();
    first.api['me']!.mockRejectedValue(httpError(401));
    first.api['refresh']!.mockRejectedValue(httpError(401));
    expect(await first.store.ensure()).toBe(false);

    TestBed.resetTestingModule();
    const second = setup();
    second.api['me']!.mockRejectedValue(httpError(0));
    expect(await second.store.ensure()).toBe(false);
    expect(second.api['refresh']).not.toHaveBeenCalled();
  });

  it('signs out locally even when the server call fails, and can expire a session', async () => {
    const { api, store } = setup();
    api['me']!.mockResolvedValue({ id: '1', email: 'a@example.com' });
    await store.ensure();
    api['logout']!.mockRejectedValue(httpError(500));
    await expect(store.signOut()).rejects.toBeTruthy();
    expect(store.user()).toBeNull();

    await store.signedIn();
    expect(store.user()).not.toBeNull();
    store.expire();
    expect(store.user()).toBeNull();
  });
});

describe('guards', () => {
  function setup(signedIn: boolean) {
    const api = fakeAdminApi();
    if (signedIn) api['me']!.mockResolvedValue({ id: '1', email: 'a@example.com' });
    else {
      api['me']!.mockRejectedValue(httpError(401));
      api['refresh']!.mockRejectedValue(httpError(401));
    }
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminApi, useValue: api },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideI18n(),
      ],
    });
  }

  it('lets signed-in users into the back-office and sends others to sign in', async () => {
    setup(true);
    expect(await runGuard<Promise<unknown>>(adminGuard)).toBe(true);
    TestBed.resetTestingModule();
    setup(false);
    const result = await runGuard<Promise<UrlTree>>(adminGuard);
    expect(result.toString()).toBe('/admin/login');
  });

  it('keeps signed-in users away from the sign-in form', async () => {
    setup(true);
    expect((await runGuard<Promise<UrlTree>>(guestGuard)).toString()).toBe('/admin');
    TestBed.resetTestingModule();
    setup(false);
    expect(await runGuard<Promise<unknown>>(guestGuard)).toBe(true);
  });

  it('marks the back-office as not indexable and switches to English', async () => {
    setup(false);
    expect(await runGuard<Promise<unknown>>(adminAreaGuard)).toBe(true);
    expect(TestBed.inject(Meta).getTag('name="robots"')?.content).toBe('noindex, nofollow');
    expect(document.documentElement.lang).toBe('en');
  });

  it('asks before leaving a form with unsaved changes', () => {
    setup(true);
    const confirmSpy = vi.spyOn(window, 'confirm');
    const run = (dirty: boolean) =>
      TestBed.runInInjectionContext(() =>
        (unsavedChangesGuard as unknown as (c: { hasUnsavedChanges(): boolean }) => boolean)({
          hasUnsavedChanges: () => dirty,
        }),
      );

    expect(run(false)).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockReturnValue(false);
    expect(run(true)).toBe(false);
    confirmSpy.mockReturnValue(true);
    expect(run(true)).toBe(true);
    confirmSpy.mockRestore();
  });
});

describe('AdminApi', () => {
  it('talks to the documented endpoints', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(AdminApi);
    const http = TestBed.inject(HttpTestingController);
    const expectCall = async (
      call: Promise<unknown>,
      method: string,
      url: string,
      body?: unknown,
    ) => {
      const request = http.expectOne(url);
      expect(request.request.method).toBe(method);
      if (body !== undefined) expect(request.request.body).toEqual(body);
      request.flush(null);
      await call;
    };

    await expectCall(api.me(), 'GET', '/api/auth/me');
    await expectCall(api.refresh(), 'POST', '/api/auth/refresh');
    await expectCall(api.login('a@b.c', 'pw'), 'POST', '/api/auth/login', {
      email: 'a@b.c',
      password: 'pw',
    });
    await expectCall(api.beginEnrollment('t'), 'POST', '/api/auth/2fa/setup', { challenge: 't' });
    await expectCall(api.enable('t', '123456'), 'POST', '/api/auth/2fa/enable', {
      challenge: 't',
      code: '123456',
    });
    await expectCall(
      api.verify('t', { recoveryCode: 'a1b2c-3d4e5' }),
      'POST',
      '/api/auth/2fa/verify',
      { challenge: 't', recoveryCode: 'a1b2c-3d4e5' },
    );
    await expectCall(api.logout(), 'POST', '/api/auth/logout');
    await expectCall(api.list('projects'), 'GET', '/api/admin/projects');
    await expectCall(api.get('projects', '1'), 'GET', '/api/admin/projects/1');
    await expectCall(api.create('projects', { a: 1 }), 'POST', '/api/admin/projects', { a: 1 });
    await expectCall(api.update('projects', '1', { a: 2 }), 'PATCH', '/api/admin/projects/1', {
      a: 2,
    });
    await expectCall(api.remove('projects', '1'), 'DELETE', '/api/admin/projects/1');
    await expectCall(api.reorder('projects', ['2', '1']), 'PUT', '/api/admin/projects/reorder', {
      ids: ['2', '1'],
    });
    await expectCall(api.getProfile(), 'GET', '/api/admin/profile');
    await expectCall(api.saveProfile({ x: 1 }), 'PUT', '/api/admin/profile', { x: 1 });

    const upload = api.upload(new File(['x'], 'a.png', { type: 'image/png' }));
    const request = http.expectOne('/api/admin/media');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get('file')).toBeInstanceOf(File);
    request.flush({ url: '/api/media/1' });
    expect((await upload).url).toBe('/api/media/1');
    http.verify();
  });
});

describe('LoginPage', () => {
  async function setup() {
    const api = fakeAdminApi();
    api['me']!.mockResolvedValue({ id: '1', email: 'a@example.com' });
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminApi, useValue: api },
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LoginPage);
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(selector: string) => el.querySelector<T>(selector)!;
    const submit = async () => {
      q('form').dispatchEvent(new Event('submit', { cancelable: true }));
      await settle(fixture);
    };
    const signIn = async () => {
      typeInto(q('#login-email'), 'admin@example.com');
      typeInto(q('#login-password'), 'a-long-password');
      await submit();
    };
    return { api, fixture, el, q, submit, signIn, navigate };
  }

  it('asks for email and password first, and does not call the server for empty fields', async () => {
    const { api, el, submit } = await setup();
    expect(el.querySelector('h1')?.textContent).toBe('Sign in');
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Enter your email and password',
    );
    expect(api['login']).not.toHaveBeenCalled();
  });

  it('says only that email or password is wrong, whatever the reason', async () => {
    const { api, el, signIn } = await setup();
    api['login']!.mockRejectedValue(httpError(401, 'Invalid credentials'));
    await signIn();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Email or password is incorrect',
    );
    expect(el.querySelector('h1')?.textContent).toBe('Sign in');
  });

  it('explains rate limiting', async () => {
    const { api, el, signIn } = await setup();
    api['login']!.mockRejectedValue(httpError(429, 'ThrottlerException: Too Many Requests'));
    await signIn();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Too many attempts');
  });

  it('asks an enrolled admin for the authenticator code, then opens the back-office', async () => {
    const { api, fixture, el, q, submit, signIn, navigate } = await setup();
    api['login']!.mockResolvedValue({ challenge: 'chal', mfaEnrolled: true });
    await signIn();
    expect(el.querySelector('h1')?.textContent).toBe('Two-factor check');
    expect((q('#login-code') as HTMLInputElement).autocomplete).toBe('one-time-code');
    expect(api['beginEnrollment']).not.toHaveBeenCalled();

    typeInto(q('#login-code'), '12');
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('6-digit');
    expect(api['verify']).not.toHaveBeenCalled();

    api['verify']!.mockRejectedValueOnce(httpError(401, 'Invalid code'));
    typeInto(q('#login-code'), '123456');
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('code was not accepted');

    api['verify']!.mockResolvedValueOnce({ ok: true });
    await submit();
    expect(api['verify']).toHaveBeenLastCalledWith('chal', { code: '123456' });
    expect(api['me']).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/admin');
    fixture.destroy();
  });

  it('accepts a recovery code in the documented format, normalized to lower case', async () => {
    const { api, fixture, el, q, submit, signIn } = await setup();
    api['login']!.mockResolvedValue({ challenge: 'chal', mfaEnrolled: true });
    await signIn();
    byText<HTMLButtonElement>(el, 'button', /Use a recovery code/).click();
    await settle(fixture);

    typeInto(q('#login-recovery'), 'not a code');
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('a1b2c-3d4e5');
    expect(api['verify']).not.toHaveBeenCalled();

    typeInto(q('#login-recovery'), 'A1B2C-3D4E5');
    api['verify']!.mockResolvedValue({ ok: true });
    await submit();
    expect(api['verify']).toHaveBeenCalledWith('chal', { recoveryCode: 'a1b2c-3d4e5' });

    byText<HTMLButtonElement>(el, 'button', /Use an authenticator code/).click();
    await settle(fixture);
    expect(el.querySelector('#login-code')).not.toBeNull();
  });

  it('returns to the password step when the five-minute challenge has expired', async () => {
    const { api, el, q, submit, signIn } = await setup();
    api['login']!.mockResolvedValue({ challenge: 'chal', mfaEnrolled: true });
    await signIn();
    api['verify']!.mockRejectedValue(httpError(401, 'Invalid or expired token'));
    typeInto(q('#login-code'), '123456');
    await submit();
    expect(el.querySelector('h1')?.textContent).toBe('Sign in');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('sign-in expired');
    expect((q('#login-password') as HTMLInputElement).value).toBe('');
  });

  it('enrolls the authenticator on first sign-in and only continues once recovery codes are saved', async () => {
    const { api, fixture, el, q, submit, signIn, navigate } = await setup();
    api['login']!.mockResolvedValue({ challenge: 'chal', mfaEnrolled: false });
    api['beginEnrollment']!.mockResolvedValue({
      otpauthUrl: 'otpauth://totp/x',
      qrDataUrl: 'data:image/png;base64,AAAA',
      secret: 'JBSWY3DPEHPK3PXP',
    });
    await signIn();
    expect(el.querySelector('h1')?.textContent).toBe('Set up two-factor');
    expect(q<HTMLImageElement>('img').src).toContain('data:image/png');
    expect(q('[data-testid="secret"]').textContent).toContain('JBSWY3DPEHPK3PXP');

    api['enable']!.mockRejectedValueOnce(httpError(401, 'Invalid code'));
    typeInto(q('#enroll-code'), '000000');
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('code was not accepted');

    const codes = Array.from({ length: 10 }, (_, i) => `abcd${i}-1234${i}`);
    api['enable']!.mockResolvedValueOnce({ recoveryCodes: codes });
    await submit();
    expect(api['enable']).toHaveBeenLastCalledWith('chal', '000000');
    expect(el.querySelector('h1')?.textContent).toBe('Save your recovery codes');
    expect(el.querySelectorAll('[data-testid="recovery-codes"] li')).toHaveLength(10);

    const open = byText<HTMLButtonElement>(el, 'button', /Open the back-office/);
    expect(open.disabled).toBe(true);
    q<HTMLInputElement>('input[type="checkbox"]').click();
    await settle(fixture);
    expect(open.disabled).toBe(false);

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    byText<HTMLButtonElement>(el, 'button', /Copy codes/).click();
    await settle(fixture);
    expect(writeText).toHaveBeenCalledWith(codes.join('\n'));
    expect(el.textContent).toContain('Copied');

    open.click();
    await settle(fixture);
    expect(navigate).toHaveBeenCalledWith('/admin');
  });

  it('reports a blocked clipboard instead of failing silently', async () => {
    const { api, fixture, el, q, submit, signIn } = await setup();
    api['login']!.mockResolvedValue({ challenge: 'chal', mfaEnrolled: false });
    api['beginEnrollment']!.mockResolvedValue({
      otpauthUrl: 'x',
      qrDataUrl: 'data:image/png;base64,AAAA',
      secret: 'S',
    });
    api['enable']!.mockResolvedValue({ recoveryCodes: ['aaaaa-bbbbb'] });
    await signIn();
    typeInto(q('#enroll-code'), '123456');
    await submit();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('no')) },
      configurable: true,
    });
    byText<HTMLButtonElement>(el, 'button', /Copy codes/).click();
    await settle(fixture);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Copying was blocked');
  });
});
