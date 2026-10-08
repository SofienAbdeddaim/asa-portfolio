import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ContentService, type ContentDoc } from './content.service.js';

const doc = (data: Record<string, unknown>) => ({ ...data, toJSON: () => data });

function makeModel() {
  const sort = vi.fn();
  const model = {
    find: vi.fn(() => ({ sort: sort.mockResolvedValue([doc({ id: '1' })]) })),
    findOne: vi.fn(() => ({ sort: () => ({ select: async () => ({ order: 4 }) }) })),
    findById: vi.fn(),
    deleteOne: vi.fn(),
    bulkWrite: vi.fn(),
    sort,
  };
  return model;
}

describe('ContentService', () => {
  it('lists only published entries in manual order by default, newest first for posts', async () => {
    const model = makeModel();
    await new ContentService(model as never, {}).listPublic();
    expect(model.find).toHaveBeenCalledWith({ published: true });
    expect(model.sort).toHaveBeenCalledWith({ order: 1, createdAt: 1 });

    await new ContentService(model as never, { publicSort: { publishedAt: -1 } }).listPublic();
    expect(model.sort).toHaveBeenLastCalledWith({ publishedAt: -1 });
  });

  it('appends new entries at the end of the order', async () => {
    const saved: Record<string, unknown>[] = [];
    class FakeDoc {
      published = false;
      publishedAt?: Date;
      constructor(public data: Record<string, unknown>) {
        Object.assign(this, data);
        saved.push(this as never);
      }
      async save() {
        return { toJSON: () => ({ order: (this as never as ContentDoc).order }) };
      }
    }
    const model = Object.assign(FakeDoc, makeModel());
    const result = await new ContentService(model as never, {}).create({ title: 'x' });
    expect(result).toEqual({ order: 5 });
  });

  it('stamps publishedAt once when a post is published', async () => {
    const entry = {
      published: false,
      publishedAt: undefined as Date | undefined,
      set: vi.fn(),
      save: vi.fn(),
      toJSON: () => ({}),
    };
    entry.set.mockImplementation((patch: { published: boolean }) => Object.assign(entry, patch));
    entry.save.mockResolvedValue(entry);
    const model = { ...makeModel(), findById: vi.fn(async () => entry) };
    const service = new ContentService(model as never, { stampPublishedAt: true });

    await service.update('1', { published: true });
    const first = entry.publishedAt;
    expect(first).toBeInstanceOf(Date);
    await service.update('1', { published: true });
    expect(entry.publishedAt).toBe(first);
  });

  it('maps duplicate slugs to 409 and missing entries to 404', async () => {
    const entry = {
      set: vi.fn(),
      save: vi.fn().mockRejectedValue({ code: 11000 }),
      published: false,
    };
    const model = { ...makeModel(), findById: vi.fn(async () => entry) };
    const service = new ContentService(model as never, { hasSlug: true });
    await expect(service.update('1', { slug: 'taken' })).rejects.toBeInstanceOf(ConflictException);

    model.findById.mockResolvedValue(null as never);
    await expect(service.update('1', {})).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findOne('1')).rejects.toBeInstanceOf(NotFoundException);

    model.deleteOne.mockResolvedValue({ deletedCount: 0 });
    await expect(service.remove('1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('persists drag-and-drop order from the position in the list', async () => {
    const model = makeModel();
    const service = new ContentService(model as never, {});
    await service.reorder(['a', 'b', 'c']);
    const operations = model.bulkWrite.mock.calls[0]![0] as {
      updateOne: { update: { $set: { order: number } } };
    }[];
    expect(operations.map((op) => op.updateOne.update.$set.order)).toEqual([0, 1, 2]);
    await expect(service.reorder(['a', 'a'])).rejects.toBeInstanceOf(ConflictException);
  });

  it('tells its owner after every successful write, so cached copies can be dropped', async () => {
    const onChange = vi.fn();
    const entry = {
      set: vi.fn(),
      save: vi.fn(async () => ({ toJSON: () => ({}) })),
      published: false,
    };
    class FakeDoc {
      published = false;
      async save() {
        return { toJSON: () => ({}) };
      }
    }
    const model = Object.assign(FakeDoc, {
      ...makeModel(),
      findById: vi.fn(async () => entry),
      deleteOne: vi.fn(async () => ({ deletedCount: 1 })),
    });
    const service = new ContentService(model as never, {}, onChange);

    await service.create({ title: 'x' });
    await service.update('1', { title: 'y' });
    await service.remove('1');
    await service.reorder(['a', 'b']);
    expect(onChange).toHaveBeenCalledTimes(4);

    // A failed write changes nothing, so nothing is dropped.
    onChange.mockClear();
    entry.save.mockRejectedValueOnce({ code: 11000 });
    await expect(service.update('1', { slug: 'taken' })).rejects.toBeInstanceOf(ConflictException);
    expect(onChange).not.toHaveBeenCalled();
  });
});
