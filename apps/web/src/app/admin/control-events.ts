import { effect, signal, type Signal } from '@angular/core';
import type { AbstractControl } from '@angular/forms';

/**
 * A counter that increases whenever the control (or any control inside it) changes value, status,
 * touched or pristine state. Reading it in a template or computed makes OnPush components follow
 * reactive forms. Call from an injection context (a field initializer).
 */
export function trackControl(control: () => AbstractControl | null | undefined): Signal<number> {
  const version = signal(0);
  effect((onCleanup) => {
    const target = control();
    if (!target) return;
    const subscription = target.events.subscribe(() => version.update((value) => value + 1));
    onCleanup(() => subscription.unsubscribe());
  });
  return version;
}
