import { z } from 'zod';
import { DomainError } from '../../../shared/kernel/errors.js';
import { parseInput } from '../../../shared/kernel/validation.js';
import {
  detectImageMimeType,
  toAvatarId,
  type AvatarId,
  type AvatarRecord,
} from '../domain/avatar.js';
import type { AvatarRepository } from './ports.js';

const avatarIdSchema = z.uuid({ error: 'Identificador de avatar inválido.' }).transform(toAvatarId);

export class AvatarService {
  constructor(private readonly repo: AvatarRepository) {}

  async upload(content: Buffer): Promise<{ readonly id: AvatarId; readonly url: string }> {
    const mimeType = detectImageMimeType(content);
    const id = await this.repo.insert(mimeType, content);
    return { id, url: `/api/avatars/${id}` };
  }

  async getById(rawId: unknown): Promise<AvatarRecord> {
    const { id } = parseInput(z.object({ id: avatarIdSchema }), { id: rawId });
    const record = await this.repo.findById(id);
    if (!record) throw new DomainError('not_found', 'AVATAR_NOT_FOUND', 'Imagem de avatar não encontrada.');
    return record;
  }
}

