import { HttpErrorResponse } from '@angular/common/http';
import { vi } from 'vitest';
import type { AdminApi } from '../app/admin/admin-api';

type Methods = {
  [K in keyof AdminApi]: AdminApi[K] extends (...args: never[]) => unknown
    ? ReturnType<typeof vi.fn>
    : never;
};

/** A fully stubbed AdminApi: every method is a vi.fn that resolves to undefined until configured. */
export function fakeAdminApi(): Methods {
  const names = [
    'me',
    'refresh',
    'login',
    'beginEnrollment',
    'enable',
    'verify',
    'logout',
    'list',
    'get',
    'create',
    'update',
    'remove',
    'reorder',
    'getProfile',
    'saveProfile',
    'upload',
  ] as const;
  return Object.fromEntries(
    names.map((name) => [name, vi.fn().mockResolvedValue(undefined)]),
  ) as unknown as Methods;
}

export const httpError = (status: number, message?: string | string[]) =>
  new HttpErrorResponse({ status, error: message === undefined ? null : { message } });

/** Waits for pending promises and renders until the component settles. */
export async function settle(fixture: {
  detectChanges(): void;
  whenStable(): Promise<unknown>;
}): Promise<void> {
  for (let i = 0; i < 4; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
  }
  fixture.detectChanges();
}

export function typeInto(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

export const byText = <T extends HTMLElement>(
  root: ParentNode,
  selector: string,
  pattern: RegExp,
): T => {
  const found = [...root.querySelectorAll<T>(selector)].find((el) =>
    pattern.test(el.textContent ?? ''),
  );
  if (!found) throw new Error(`No ${selector} matching ${pattern}`);
  return found;
};
