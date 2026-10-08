import { Injectable } from '@nestjs/common';

/** Long enough to absorb a burst of page loads, short enough that nobody notices it. */
const TTL_MS = 5_000;

/**
 * Remembers the public snapshot for a few seconds. Every page load asks for it and building it
 * takes about a dozen queries, which the free database tier cannot serve at the rate a flood of
 * requests could ask. Any change made in the back-office clears it at once.
 */
@Injectable()
export class SnapshotCache {
  private entry: { at: number; value: unknown } | undefined;
  private generation = 0;

  /** The remembered snapshot, if there is a fresh one. */
  get(now = Date.now()): unknown {
    return this.entry && now - this.entry.at < TTL_MS ? this.entry.value : undefined;
  }

  /** Call before building a snapshot and hand the result to `set` with it. */
  begin(): number {
    return this.generation;
  }

  /** Stores a snapshot unless something changed while it was being built. */
  set(value: unknown, generation: number, now = Date.now()): void {
    if (generation === this.generation) this.entry = { at: now, value };
  }

  invalidate(): void {
    this.generation += 1;
    this.entry = undefined;
  }
}
