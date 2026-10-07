import { ViewportScroller } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, pairwise, startWith } from 'rxjs';
import { isLocaleSwitch } from './locale';

/**
 * Scrolls to the top on real navigations, but leaves the scroll position alone when only the
 * language changed, so switching language does not lose the reader's place.
 */
@Injectable({ providedIn: 'root' })
export class ScrollService {
  private readonly router = inject(Router);
  private readonly scroller = inject(ViewportScroller);

  start(): void {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        startWith(null),
        pairwise(),
      )
      .subscribe(([previous, current]) => {
        if (!previous || !current) return;
        if (current.urlAfterRedirects.includes('#')) return; // anchorScrolling handles fragments
        if (isLocaleSwitch(previous.urlAfterRedirects, current.urlAfterRedirects)) return;
        this.scroller.scrollToPosition([0, 0]);
      });
  }
}
