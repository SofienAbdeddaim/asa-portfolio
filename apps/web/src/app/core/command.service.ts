import { Injectable, computed, signal } from '@angular/core';
import { normalizeSearch } from './locale';

export interface Command {
  id: string;
  /** Already translated, shown to the user. */
  label: string;
  /** Extra words that should match the search (translated). */
  keywords?: string;
  group: string;
  run: () => void;
}

/** Registry behind the Ctrl+K palette. Pages and the shell register their own commands. */
@Injectable({ providedIn: 'root' })
export class CommandService {
  private readonly sources = signal<ReadonlyMap<string, readonly Command[]>>(new Map());
  readonly open = signal(false);
  readonly commands = computed(() => [...this.sources().values()].flat());

  /** Registers (or replaces) a named set of commands. Returns an unregister function. */
  register(source: string, commands: readonly Command[]): () => void {
    this.sources.update((map) => new Map(map).set(source, commands));
    return () =>
      this.sources.update((map) => {
        const next = new Map(map);
        next.delete(source);
        return next;
      });
  }

  filter(query: string): Command[] {
    const needle = normalizeSearch(query);
    const all = this.commands();
    if (!needle) return all;
    return all.filter((command) =>
      normalizeSearch(`${command.label} ${command.keywords ?? ''}`).includes(needle),
    );
  }

  show(): void {
    this.open.set(true);
  }

  hide(): void {
    this.open.set(false);
  }

  toggle(): void {
    this.open.update((value) => !value);
  }
}
