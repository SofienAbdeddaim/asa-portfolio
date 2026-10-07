import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { ResourceDefinition } from './resources.js';

export interface ContentDoc {
  order: number;
  published: boolean;
  publishedAt?: Date;
  [key: string]: unknown;
}

const DUPLICATE_KEY = 11000;

const isDuplicate = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: number }).code === DUPLICATE_KEY;

/** Generic CRUD + ordering for one ordered, publishable resource. */
export class ContentService {
  constructor(
    private readonly model: Model<ContentDoc>,
    private readonly definition: Pick<
      ResourceDefinition,
      'hasSlug' | 'stampPublishedAt' | 'publicSort'
    >,
  ) {}

  async listPublic() {
    const sort = this.definition.publicSort ?? { order: 1, createdAt: 1 };
    const docs = await this.model.find({ published: true }).sort(sort);
    return docs.map((doc) => doc.toJSON());
  }

  async listAll() {
    const docs = await this.model.find().sort({ order: 1, createdAt: 1 });
    return docs.map((doc) => doc.toJSON());
  }

  async findPublicBySlug(slug: string) {
    const doc = await this.model.findOne({ slug, published: true });
    if (!doc) throw new NotFoundException();
    return doc.toJSON();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException();
    return doc.toJSON();
  }

  async create(data: Record<string, unknown>) {
    const last = await this.model.findOne().sort({ order: -1 }).select('order');
    try {
      const doc = new this.model({ ...data, order: (last?.order ?? -1) + 1 });
      this.stamp(doc);
      return (await doc.save()).toJSON();
    } catch (error) {
      if (isDuplicate(error)) throw new ConflictException('Slug already in use');
      throw error;
    }
  }

  async update(id: string, patch: Record<string, unknown>) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException();
    doc.set(patch);
    this.stamp(doc);
    try {
      return (await doc.save()).toJSON();
    } catch (error) {
      if (isDuplicate(error)) throw new ConflictException('Slug already in use');
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.model.deleteOne({ _id: id });
    if (result.deletedCount !== 1) throw new NotFoundException();
  }

  /** Persists the drag-and-drop order: the position in `ids` becomes the new `order`. */
  async reorder(ids: string[]): Promise<void> {
    if (new Set(ids).size !== ids.length) throw new ConflictException('Duplicate ids');
    if (ids.length === 0) return;
    await this.model.bulkWrite(
      ids.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
      })),
    );
  }

  private stamp(doc: { published: boolean; publishedAt?: Date | undefined }): void {
    if (this.definition.stampPublishedAt && doc.published && !doc.publishedAt) {
      doc.publishedAt = new Date();
    }
  }
}
