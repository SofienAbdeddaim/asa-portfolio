import { Types } from 'mongoose';

type Row = Record<string, unknown> & { _id: Types.ObjectId; id: string };
type Filter = Record<string, unknown>;

const isLessThan = (value: unknown): value is { $lt: number } =>
  typeof value === 'object' && value !== null && '$lt' in value;

/**
 * Minimal in-memory stand-in for a Mongoose model: just the operations the auth service uses
 * ($set, $unset, $pull, $lt and array-contains matching). Documents are plain mutable rows.
 */
export function createFakeModel(defaults: Record<string, unknown> = {}) {
  const rows: Row[] = [];

  const matches = (row: Row, filter: Filter): boolean =>
    Object.entries(filter).every(([key, expected]) => {
      const actual = row[key];
      if (isLessThan(expected)) return (actual as number) < expected.$lt;
      if (Array.isArray(actual)) return actual.includes(expected);
      return String(actual) === String(expected);
    });

  const wrap = (row: Row | undefined) =>
    row ? Object.assign(row, { save: async () => row }) : null;

  return {
    rows,
    async create(data: Record<string, unknown>) {
      const _id = new Types.ObjectId();
      const row = { ...structuredClone(defaults), ...data, _id, id: _id.toString() } as Row;
      rows.push(row);
      return wrap(row);
    },
    async findOne(filter: Filter) {
      return wrap(rows.find((row) => matches(row, filter)));
    },
    async findById(id: string) {
      return wrap(rows.find((row) => row.id === String(id)));
    },
    async exists(filter: Filter) {
      const row = rows.find((candidate) => matches(candidate, filter));
      return row ? { _id: row._id } : null;
    },
    async updateOne(filter: Filter, update: Record<string, Record<string, unknown>>) {
      const row = rows.find((candidate) => matches(candidate, filter));
      if (!row) return { matchedCount: 0, modifiedCount: 0 };
      Object.assign(row, update['$set'] ?? {});
      for (const [key, by] of Object.entries(update['$inc'] ?? {})) {
        row[key] = ((row[key] as number | undefined) ?? 0) + (by as number);
      }
      for (const key of Object.keys(update['$unset'] ?? {})) delete row[key];
      for (const [key, value] of Object.entries(update['$pull'] ?? {})) {
        row[key] = (row[key] as unknown[]).filter((item) => item !== value);
      }
      return { matchedCount: 1, modifiedCount: 1 };
    },
    async deleteMany(filter: Filter) {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matches(rows[i] as Row, filter)) rows.splice(i, 1);
      }
    },
    async deleteOne(filter: Filter) {
      const index = rows.findIndex((row) => matches(row, filter));
      if (index >= 0) rows.splice(index, 1);
      return { deletedCount: index >= 0 ? 1 : 0 };
    },
  };
}

export type FakeModel = ReturnType<typeof createFakeModel>;
