import { Module } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { mongo, type Connection } from 'mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { MediaController } from './media.controller.js';
import { MEDIA_BUCKET, MediaService } from './media.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: MEDIA_BUCKET,
      inject: [getConnectionToken()],
      // The connection is established before the application starts, so `db` is available.
      useFactory: (connection: Connection) =>
        new mongo.GridFSBucket(connection.db as mongo.Db, { bucketName: 'media' }),
    },
  ],
})
export class MediaModule {}
