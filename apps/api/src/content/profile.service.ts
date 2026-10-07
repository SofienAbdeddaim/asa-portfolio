import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

export const PROFILE_MODEL = 'Profile';

export interface ProfileDoc {
  [key: string]: unknown;
}

/** The profile is a singleton: one document, replaced as a whole. */
@Injectable()
export class ProfileService {
  constructor(@InjectModel(PROFILE_MODEL) private readonly model: Model<ProfileDoc>) {}

  async get() {
    const doc = await this.model.findOne();
    return doc ? doc.toJSON() : null;
  }

  async replace(data: Record<string, unknown>) {
    const doc = await this.model.findOneAndUpdate(
      {},
      { $set: data },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    return doc.toJSON();
  }
}
