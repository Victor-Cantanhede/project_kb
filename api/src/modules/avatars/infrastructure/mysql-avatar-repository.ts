import { randomUUID } from 'node:crypto';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import { execute, selectRows } from '../../../shared/infra/db.js';
import {
  ALLOWED_AVATAR_MIMES,
  toAvatarId,
  type AvatarId,
  type AvatarMimeType,
  type AvatarRecord,
} from '../domain/avatar.js';
import type { AvatarRepository } from '../application/ports.js';

const avatarRowSchema = z.object({
  id: z.string().transform(toAvatarId),
  mime_type: z.enum(ALLOWED_AVATAR_MIMES),
  content: z.instanceof(Buffer),
});

export class MysqlAvatarRepository implements AvatarRepository {
  constructor(private readonly pool: Pool) {}

  async insert(mimeType: AvatarMimeType, content: Buffer): Promise<AvatarId> {
    const id = toAvatarId(randomUUID());
    await execute(
      this.pool,
      'INSERT INTO avatars (id, mime_type, content, created_at) VALUES (?, ?, ?, ?)',
      [id, mimeType, content, new Date()],
    );
    return id;
  }

  async findById(id: AvatarId): Promise<AvatarRecord | null> {
    const rows = await selectRows(
      this.pool,
      avatarRowSchema,
      'SELECT id, mime_type, content FROM avatars WHERE id = ?',
      [id],
    );
    return rows[0] ?? null;
  }
}

