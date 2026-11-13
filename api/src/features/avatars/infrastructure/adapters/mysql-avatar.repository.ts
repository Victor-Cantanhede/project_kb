import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { MysqlDatabaseService } from '../../../../core/database/mysql-database.service.js';
import {
  ALLOWED_AVATAR_MIMES,
  AvatarEntity,
} from '../../domain/entities/avatar.entity.js';
import type { IAvatarRepository } from '../../domain/ports/avatar-repository.port.js';

const avatarRowSchema = z.object({
  id: z.string(),
  mime_type: z.enum(ALLOWED_AVATAR_MIMES),
  content: z.instanceof(Buffer),
  created_at: z
    .union([z.date(), z.string()])
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

@Injectable()
export class MysqlAvatarRepository implements IAvatarRepository {
  constructor(
    @Inject(MysqlDatabaseService)
    private readonly db: MysqlDatabaseService,
  ) {}

  async save(avatar: AvatarEntity): Promise<void> {
    const createdAt = avatar.createdAt ?? new Date();
    await this.db.execute(
      this.db.getPool(),
      'INSERT INTO avatars (id, mime_type, content, created_at) VALUES (?, ?, ?, ?)',
      [avatar.id, avatar.mimeType, avatar.content, createdAt],
    );
  }

  async findById(id: string): Promise<AvatarEntity | null> {
    const rows = await this.db.selectRows(
      this.db.getPool(),
      avatarRowSchema,
      'SELECT id, mime_type, content, created_at FROM avatars WHERE id = ?',
      [id],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return new AvatarEntity({
      id: row.id,
      mimeType: row.mime_type,
      content: row.content,
      createdAt: row.created_at,
    });
  }
}
