import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy, type ActivatedRouteSnapshot } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

/** Sets the document title from the route's `titleKey`, translated in the active language. */
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.titleKey(snapshot.root);
    const brand = this.transloco.translate('app.brand');
    this.title.setTitle(key ? `${this.transloco.translate(key)} · ${brand}` : brand);
  }

  private titleKey(route: ActivatedRouteSnapshot): string | undefined {
    let found = route.data['titleKey'] as string | undefined;
    for (const child of route.children) found = this.titleKey(child) ?? found;
    return found;
  }
}
