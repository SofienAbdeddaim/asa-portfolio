import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  /** Destructive actions get a warning color. */
  danger?: boolean;
}

/** Ask the user to confirm before something irreversible. Resolves to the answer. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly request = signal<(ConfirmRequest & { resolve: (answer: boolean) => void }) | null>(null);

  ask(request: ConfirmRequest): Promise<boolean> {
    return new Promise((resolve) => this.request.set({ ...request, resolve }));
  }

  answer(value: boolean): void {
    this.request()?.resolve(value);
    this.request.set(null);
  }
}

export interface Toast {
  message: string;
  kind: 'success' | 'error';
}

/** A short status message, announced politely to assistive technology. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toast = signal<Toast | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  show(message: string, kind: Toast['kind'] = 'success'): void {
    clearTimeout(this.timer);
    this.toast.set({ message, kind });
    this.timer = setTimeout(() => this.toast.set(null), kind === 'error' ? 8000 : 4000);
  }

  clear(): void {
    clearTimeout(this.timer);
    this.toast.set(null);
  }
}
