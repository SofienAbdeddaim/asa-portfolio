import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ParseObjectIdPipe } from '../common/object-id.pipe.js';
import { MAX_UPLOAD_BYTES, MediaService } from './media.service.js';

interface UploadedImage {
  buffer: Buffer;
  originalname: string;
}

@ApiTags('media')
@Controller()
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  /** Public and immutable: an id never changes content, so browsers and CDNs may cache it forever. */
  @Get('media/:id')
  async get(@Param('id', ParseObjectIdPipe) id: string, @Res() res: Response) {
    const { stream, length, contentType } = await this.media.open(id);
    res.set({
      'Content-Type': contentType,
      'Content-Length': String(length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }

  @Post('admin/media')
  @ApiCookieAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async upload(@UploadedFile() file: UploadedImage | undefined) {
    if (!file) throw new BadRequestException('Send the image in a "file" field');
    return this.media.save(file.buffer, file.originalname);
  }

  @Delete('admin/media/:id')
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async remove(@Param('id', ParseObjectIdPipe) id: string) {
    await this.media.remove(id);
  }
}
