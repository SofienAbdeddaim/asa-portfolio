import { Directive } from '@angular/core';

/** Placeholder block shown while content loads. The pulse stops under `prefers-reduced-motion`. */
@Directive({
  selector: '[appSkeleton]',
  host: {
    'aria-hidden': 'true',
    class: 'block rounded-md bg-surface-2 motion-safe:animate-pulse',
  },
})
export class Skeleton {}
