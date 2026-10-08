import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

/**
 * Brings in the Arabic font faces (about 190 KB). They are declared by a component instead of the
 * global stylesheet so that only Arabic pages ask for them: the build inlines and preloads every
 * font in the global stylesheet, which would make English and French visitors download Arabic
 * fonts they never see.
 */
@Component({
  selector: 'app-arabic-fonts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './arabic-fonts.css',
  template: '',
})
export class ArabicFonts {}
