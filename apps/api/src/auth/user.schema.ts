import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ type: String, required: true })
  passwordHash!: string;

  @Prop({ type: Boolean, default: false })
  totpEnabled!: boolean;

  /** AES-GCM encrypted base32 secret of the active authenticator. */
  @Prop({ type: String })
  totpSecretEnc?: string;

  /** Secret generated during enrollment, promoted to `totpSecretEnc` once a code is confirmed. */
  @Prop({ type: String })
  totpPendingSecretEnc?: string;

  /** Last accepted TOTP time step, to reject replayed codes. */
  @Prop({ type: Number, default: 0 })
  lastTotpStep!: number;

  /** Keyed hashes (HMAC) of unused recovery codes. */
  @Prop({ type: [String], default: [] })
  recoveryCodeHashes!: string[];

  @Prop({ type: Number, default: 0 })
  failedLogins!: number;

  /** Wrong second-factor codes in a row (counted apart from wrong passwords). */
  @Prop({ type: Number, default: 0 })
  failedMfa!: number;

  @Prop({ type: Date })
  lockedUntil?: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
export const USER_MODEL = User.name;
