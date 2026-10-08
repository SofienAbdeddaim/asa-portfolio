import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Types, type mongo } from 'mongoose';
import { Readable } from 'node:stream';
import sharp from 'sharp';

export const MEDIA_BUCKET = 'MEDIA_BUCKET';
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Everything is resized down to fit this box and stored as WebP. */
export const MAX_DIMENSION = 1600;
/** Decoder safety limit against decompression bombs (about 40 megapixels). */
const MAX_INPUT_PIXELS = 40_000_000;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif']);

export interface StoredImage {
  id: string;
  url: string;
  bytes: number;
  width: number;
  height: number;
}

export interface MediaDownload {
  stream: Readable;
  length: number;
  contentType: string;
}

/**
 * Image storage in GridFS. Uploads are trusted for nothing: the bytes must decode as a real
 * raster image (the declared MIME type is ignored), animation and metadata such as EXIF/GPS are
 * dropped, and the result is re-encoded as WebP no larger than 1600px.
 */
@Injectable()
export class MediaService {
  constructor(@Inject(MEDIA_BUCKET) private readonly bucket: mongo.GridFSBucket) {}

  async process(input: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
    try {
      const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });
      const { format } = await image.metadata();
      if (!format || !ACCEPTED_FORMATS.has(format)) throw new Error(`unsupported format ${format}`);
      const { data, info } = await image
        .rotate() // applies the EXIF orientation; metadata itself is not copied to the output
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
      return { data, width: info.width, height: info.height };
    } catch {
      throw new BadRequestException(
        'The file is not a supported image (JPEG, PNG, WebP, GIF or AVIF)',
      );
    }
  }

  async save(input: Buffer, originalName: string): Promise<StoredImage> {
    const { data, width, height } = await this.process(input);
    const upload = this.bucket.openUploadStream(safeName(originalName), {
      metadata: { contentType: 'image/webp', width, height },
    });
    await new Promise<void>((resolve, reject) => {
      upload.once('finish', () => resolve());
      upload.once('error', reject);
      Readable.from(data).pipe(upload);
    });
    const id = upload.id.toString();
    return { id, url: `/api/media/${id}`, bytes: data.length, width, height };
  }

  async open(id: string): Promise<MediaDownload> {
    const [file] = await this.bucket.find({ _id: new Types.ObjectId(id) }).toArray();
    if (!file) throw new NotFoundException();
    return {
      stream: this.bucket.openDownloadStream(file._id) as unknown as Readable,
      length: file.length,
      contentType: (file.metadata?.['contentType'] as string | undefined) ?? 'image/webp',
    };
  }

  async remove(id: string): Promise<void> {
    try {
      await this.bucket.delete(new Types.ObjectId(id));
    } catch (error) {
      if ((error as Error).message?.includes('FileNotFound')) throw new NotFoundException();
      throw error;
    }
  }
}

/** Keeps only a short, harmless display name: the stored bytes never depend on it. */
export function safeName(name: string): string {
  const leaf = name.split(/[\\/]/).pop() ?? '';
  const base = leaf
    .replace(/\.[^.]*$/, '')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'image'}.webp`;
}
