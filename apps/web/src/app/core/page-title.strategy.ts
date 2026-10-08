import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy, type ActivatedRouteSnapshot } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Sets the document title:
 * - a translated `titleKey` route datum becomes "Title · Brand";
 * - a route with `data.fullTitle` uses its `title` as is (content-dependent titles);
 * - any other route `title` (the English-only back-office) becomes "Title · Brand".
 */
@Injectable({ providedIn: 'root' })
export class PageTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const brand = this.transloco.translate('app.brand');
    const key = this.find(snapshot.root, 'titleKey') as string | undefined;
    if (key) {
      this.title.setTitle(`${this.transloco.translate(key)} · ${brand}`);
      return;
    }
    const plain = this.buildTitle(snapshot);
    if (plain && this.find(snapshot.root, 'fullTitle')) this.title.setTitle(plain);
    else this.title.setTitle(plain ? `${plain} · ${brand}` : brand);
  }

  private find(route: ActivatedRouteSnapshot, key: string): unknown {
    let found = route.data[key];
    for (const child of route.children) found = this.find(child, key) ?? found;
    return found;
  }
}
