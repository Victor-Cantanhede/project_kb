import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MysqlAvatarRepository } from './mysql-avatar.repository.js';
import type { MysqlDatabaseService } from '../../../../core/database/mysql-database.service.js';
import { AvatarEntity } from '../../domain/entities/avatar.entity.js';

describe('MysqlAvatarRepository', () => {
  let mockDb: {
    getPool: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
    selectRows: ReturnType<typeof vi.fn>;
  };
  let fakePool: object;
  let repo: MysqlAvatarRepository;

  beforeEach(() => {
    fakePool = {};
    mockDb = {
      getPool: vi.fn().mockReturnValue(fakePool),
      execute: vi.fn().mockResolvedValue({}),
      selectRows: vi.fn(),
    };
    repo = new MysqlAvatarRepository(mockDb as unknown as MysqlDatabaseService);
  });

  it('deve inserir avatar na tabela avatars', async () => {
    const avatar = new AvatarEntity({
      id: 'avatar-uuid-1',
      mimeType: 'image/png',
      content: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    await repo.save(avatar);

    expect(mockDb.execute).toHaveBeenCalledWith(
      fakePool,
      'INSERT INTO avatars (id, mime_type, content, created_at) VALUES (?, ?, ?, ?)',
      [avatar.id, avatar.mimeType, avatar.content, avatar.createdAt],
    );
  });

  it('deve buscar avatar por id e retornar AvatarEntity preenchido', async () => {
    const fakeRow = {
      id: 'avatar-uuid-1',
      mime_type: 'image/jpeg',
      content: Buffer.from([0xff, 0xd8, 0xff]),
      created_at: new Date('2026-01-01T00:00:00Z'),
    };
    mockDb.selectRows.mockResolvedValueOnce([fakeRow]);

    const result = await repo.findById('avatar-uuid-1');

    expect(result).toBeInstanceOf(AvatarEntity);
    expect(result?.id).toBe('avatar-uuid-1');
    expect(result?.mimeType).toBe('image/jpeg');
    expect(result?.content).toEqual(fakeRow.content);
    expect(result?.createdAt).toEqual(fakeRow.created_at);
  });

  it('deve retornar null se o avatar não for encontrado', async () => {
    mockDb.selectRows.mockResolvedValueOnce([]);

    const result = await repo.findById('non-existent');

    expect(result).toBeNull();
  });
});
