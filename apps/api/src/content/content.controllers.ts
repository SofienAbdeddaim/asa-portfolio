import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  type Type,
} from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '../common/object-id.pipe.js';
import { ValidBody } from '../common/validation.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { ContentService } from './content.service.js';
import { ReorderDto } from './dto.js';
import { serviceToken, type ResourceDefinition } from './resources.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Builds the public (read-only, published) and admin (full CRUD) controllers of a resource. */
export function createContentControllers(definition: ResourceDefinition): Type<unknown>[] {
  const token = serviceToken(definition);
  const createDto = definition.dto;
  const updateDto = PartialType(createDto);

  @ApiTags(definition.path)
  @Controller(definition.path)
  class PublicController {
    constructor(@Inject(token) readonly service: ContentService) {}

    @Get()
    list() {
      return this.service.listPublic();
    }

    @Get('slug/:slug')
    bySlug(@Param('slug') slug: string) {
      // Guard: a filter on an unknown path would be dropped by Mongoose and match any document.
      if (!definition.hasSlug || !SLUG_PATTERN.test(slug)) throw new NotFoundException();
      return this.service.findPublicBySlug(slug);
    }
  }

  @ApiTags(`admin/${definition.path}`)
  @ApiCookieAuth()
  @UseGuards(JwtAuthGuard)
  @Controller(`admin/${definition.path}`)
  class AdminController {
    constructor(@Inject(token) readonly service: ContentService) {}

    @Get()
    list() {
      return this.service.listAll();
    }

    @Put('reorder')
    @HttpCode(204)
    async reorder(@ValidBody(ReorderDto) dto: ReorderDto) {
      await this.service.reorder(dto.ids);
    }

    @Get(':id')
    one(@Param('id', ParseObjectIdPipe) id: string) {
      return this.service.findOne(id);
    }

    @Post()
    @ApiBody({ type: createDto })
    create(@ValidBody(createDto) dto: Record<string, unknown>) {
      return this.service.create(dto);
    }

    @Patch(':id')
    @ApiBody({ type: updateDto })
    update(
      @Param('id', ParseObjectIdPipe) id: string,
      @ValidBody(updateDto) dto: Record<string, unknown>,
    ) {
      return this.service.update(id, dto);
    }

    @Delete(':id')
    @HttpCode(204)
    remove(@Param('id', ParseObjectIdPipe) id: string) {
      return this.service.remove(id);
    }
  }

  return [PublicController, AdminController];
}
