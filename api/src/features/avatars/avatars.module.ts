import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { AVATAR_REPOSITORY_TOKEN } from './domain/ports/avatar-repository.port.js';
import { MysqlAvatarRepository } from './infrastructure/adapters/mysql-avatar.repository.js';
import { UploadAvatarUseCase } from './application/use-cases/upload-avatar.use-case.js';
import { GetAvatarUseCase } from './application/use-cases/get-avatar.use-case.js';
import { AvatarsController } from './presentation/avatars.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AvatarsController],
  providers: [
    UploadAvatarUseCase,
    GetAvatarUseCase,
    {
      provide: AVATAR_REPOSITORY_TOKEN,
      useClass: MysqlAvatarRepository,
    },
  ],
  exports: [
    UploadAvatarUseCase,
    GetAvatarUseCase,
    AVATAR_REPOSITORY_TOKEN,
  ],
})
export class AvatarsModule {}
