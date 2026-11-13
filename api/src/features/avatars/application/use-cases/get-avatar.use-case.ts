import { Inject, Injectable } from '@nestjs/common';
import {
  AVATAR_REPOSITORY_TOKEN,
  type IAvatarRepository,
} from '../../domain/ports/avatar-repository.port.js';
import type { AvatarEntity } from '../../domain/entities/avatar.entity.js';
import { DomainError, validationError } from '../../../../core/errors/domain.exception.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class GetAvatarUseCase {
  constructor(
    @Inject(AVATAR_REPOSITORY_TOKEN)
    private readonly avatarRepo: IAvatarRepository,
  ) {}

  async execute(id: string): Promise<AvatarEntity> {
    if (!id || typeof id !== 'string' || !UUID_REGEX.test(id)) {
      throw validationError([{ field: 'id', message: 'Identificador de avatar inválido.' }]);
    }

    const avatar = await this.avatarRepo.findById(id);
    if (!avatar) {
      throw new DomainError('not_found', 'AVATAR_NOT_FOUND', 'Avatar não encontrado.');
    }

    return avatar;
  }
}
