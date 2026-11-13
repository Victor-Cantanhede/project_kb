import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  AVATAR_REPOSITORY_TOKEN,
  type IAvatarRepository,
} from '../../domain/ports/avatar-repository.port.js';
import { AvatarEntity } from '../../domain/entities/avatar.entity.js';
import { validateImageMagicBytes } from '../../domain/utils/image-magic-bytes.validator.js';

export interface UploadAvatarResult {
  readonly id: string;
  readonly url: string;
}

@Injectable()
export class UploadAvatarUseCase {
  constructor(
    @Inject(AVATAR_REPOSITORY_TOKEN)
    private readonly avatarRepo: IAvatarRepository,
  ) {}

  async execute(content: Buffer): Promise<UploadAvatarResult> {
    const mimeType = validateImageMagicBytes(content);
    const id = randomUUID();
    const avatar = new AvatarEntity({
      id,
      mimeType,
      content,
      createdAt: new Date(),
    });

    await this.avatarRepo.save(avatar);

    return {
      id,
      url: `/api/avatars/${id}`,
    };
  }
}
