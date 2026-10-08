import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy, type ActivatedRouteSnapshot } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Sets the document title. Public pages use a translated `titleKey` route datum; other routes (the
 * English-only back-office) use the plain `title` of the route.
 */
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const brand = this.transloco.translate('app.brand');
    const key = this.titleKey(snapshot.root);
    if (key) {
      this.title.setTitle(`${this.transloco.translate(key)} · ${brand}`);
      return;
    }
    const plain = this.buildTitle(snapshot);
    this.title.setTitle(plain ? `${plain} · ${brand}` : brand);
  }

  private titleKey(route: ActivatedRouteSnapshot): string | undefined {
    let found = route.data['titleKey'] as string | undefined;
    for (const child of route.children) found = this.titleKey(child) ?? found;
    return found;
  }
}
