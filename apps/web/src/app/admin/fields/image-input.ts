import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ReactiveFormsModule, type FormControl } from '@angular/forms';
import { AdminApi } from '../admin-api';
import { apiMessage } from '../api-error';
import { trackControl } from '../control-events';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * An image URL with a preview and an upload button. Files are checked here for quick feedback and
 * again, much more strictly, by the server (which decodes, resizes and re-encodes them as WebP).
 */
@Component({
  selector: 'app-image-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="flex flex-wrap items-start gap-4">
      @if (url()) {
        <img
          [src]="url()"
          alt=""
          class="size-24 rounded-lg border-2 border-ink bg-surface-2 object-cover"
          loading="lazy"
        />
      } @else {
        <div
          class="grid size-24 place-items-center rounded-lg border-2 border-dashed border-ink text-xs text-muted"
          aria-hidden="true"
        >
          No image
        </div>
      }

      <div class="grid min-w-0 flex-1 gap-2">
        <div class="flex flex-wrap gap-2">
          <label class="a-btn cursor-pointer" [class.opacity-60]="busy()" [for]="inputId()">
            {{ busy() ? 'Uploading…' : url() ? 'Replace image' : 'Upload image' }}
          </label>
          <input
            type="file"
            class="sr-only"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            [id]="inputId()"
            [disabled]="busy()"
            (change)="onFile($event)"
          />
          @if (url()) {
            <button type="button" class="a-btn a-btn-danger" (click)="remove()">Remove</button>
          }
        </div>
        <label class="a-help mt-0!" [for]="inputId() + '-url'">Or paste an image address</label>
        <input
          type="text"
          class="a-input"
          [id]="inputId() + '-url'"
          [formControl]="control()"
          [attr.aria-invalid]="control().invalid && control().touched"
        />
        <p class="a-error" role="alert">{{ message() }}</p>
        <p class="a-help">
          JPEG, PNG, WebP, GIF or AVIF up to 5 MB. Resized and converted to WebP.
        </p>
      </div>
    </div>
  `,
})
export class ImageInput {
  readonly control = input.required<FormControl<string>>();
  readonly inputId = input.required<string>();

  private readonly api = inject(AdminApi);
  private readonly version = trackControl(() => this.control());

  protected readonly busy = signal(false);
  protected readonly message = signal('');
  protected readonly url = computed(() => {
    this.version();
    return this.control().value;
  });

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so choosing the same file again still triggers a change
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.message.set('Choose an image file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      this.message.set('That file is too large (5 MB maximum).');
      return;
    }

    this.message.set('');
    this.busy.set(true);
    try {
      const { url } = await this.api.upload(file);
      this.control().setValue(url);
      this.control().markAsDirty();
    } catch (error) {
      this.message.set(apiMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected remove(): void {
    this.control().setValue('');
    this.control().markAsDirty();
    this.message.set('');
  }
}
