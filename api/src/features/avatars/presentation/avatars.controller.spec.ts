import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { AvatarsController } from './avatars.controller.js';
import type { UploadAvatarUseCase } from '../application/use-cases/upload-avatar.use-case.js';
import type { GetAvatarUseCase } from '../application/use-cases/get-avatar.use-case.js';
import * as multipartUtil from '../../../core/security/multipart-file.util.js';
import { AvatarEntity } from '../domain/entities/avatar.entity.js';

describe('AvatarsController', () => {
  let mockUploadUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockGetUseCase: { execute: ReturnType<typeof vi.fn> };
  let controller: AvatarsController;

  beforeEach(() => {
    mockUploadUseCase = {
      execute: vi.fn(),
    };
    mockGetUseCase = {
      execute: vi.fn(),
    };
    controller = new AvatarsController(
      mockUploadUseCase as unknown as UploadAvatarUseCase,
      mockGetUseCase as unknown as GetAvatarUseCase,
    );
  });

  describe('POST /avatars', () => {
    it('deve ler arquivo multipart via readSingleMultipartFile e delegar para UploadAvatarUseCase', async () => {
      const fakeBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const fakeReq = {} as Request;

      vi.spyOn(multipartUtil, 'readSingleMultipartFile').mockResolvedValueOnce({
        filename: 'avatar.png',
        buffer: fakeBuffer,
        mimeType: 'image/png',
      });

      mockUploadUseCase.execute.mockResolvedValueOnce({
        id: 'new-avatar-id',
        url: '/api/avatars/new-avatar-id',
      });

      const result = await controller.uploadAvatar(fakeReq);

      expect(multipartUtil.readSingleMultipartFile).toHaveBeenCalledWith(
        fakeReq,
        'Nenhum arquivo enviado.',
        2 * 1024 * 1024,
      );
      expect(mockUploadUseCase.execute).toHaveBeenCalledWith(fakeBuffer);
      expect(result).toEqual({
        id: 'new-avatar-id',
        url: '/api/avatars/new-avatar-id',
      });
    });
  });

  describe('GET /avatars/:id', () => {
    it('deve buscar avatar e definir os headers de cache e mime type corretos antes de enviar o buffer', async () => {
      const avatarId = '11111111-2222-4333-8444-555555555555';
      const fakeContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]);
      const fakeAvatar = new AvatarEntity({
        id: avatarId,
        mimeType: 'image/png',
        content: fakeContent,
      });

      mockGetUseCase.execute.mockResolvedValueOnce(fakeAvatar);

      const headers: Record<string, string> = {};
      let sentBody: unknown = null;

      const fakeRes = {
        setHeader: vi.fn((key: string, val: string) => {
          headers[key] = val;
        }),
        send: vi.fn((body: unknown) => {
          sentBody = body;
        }),
      } as unknown as Response;

      await controller.getAvatar(avatarId, fakeRes);

      expect(mockGetUseCase.execute).toHaveBeenCalledWith(avatarId);
      expect(headers['Content-Type']).toBe('image/png');
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
      expect(sentBody).toEqual(fakeContent);
    });

    it('deve propagar erro se o caso de uso lançar exceção', async () => {
      mockGetUseCase.execute.mockRejectedValueOnce(new Error('Avatar not found'));
      const fakeRes = {
        setHeader: vi.fn(),
        send: vi.fn(),
      } as unknown as Response;

      await expect(controller.getAvatar('invalid-id', fakeRes)).rejects.toThrow('Avatar not found');
    });
  });
});
