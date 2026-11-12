import type { AvatarId, AvatarMimeType, AvatarRecord } from '../domain/avatar.js';

export interface AvatarRepository {
  insert(mimeType: AvatarMimeType, content: Buffer): Promise<AvatarId>;
  findById(id: AvatarId): Promise<AvatarRecord | null>;
}

