import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Session {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId!: Types.ObjectId;

  /** SHA-256 of the current refresh secret. Rotated on every refresh. */
  @Prop({ type: String, required: true })
  secretHash!: string;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  /** Added by the `timestamps` option: when the second-factor sign-in happened. */
  createdAt?: Date;
}

export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const SESSION_MODEL = Session.name;
