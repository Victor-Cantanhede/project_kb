import type { AvatarEntity } from '../entities/avatar.entity.js';

export const AVATAR_REPOSITORY_TOKEN = Symbol('IAvatarRepository');

export interface IAvatarRepository {
  save(avatar: AvatarEntity): Promise<void>;
  findById(id: string): Promise<AvatarEntity | null>;
}
