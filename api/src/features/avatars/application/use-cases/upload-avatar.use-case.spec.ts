import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UploadAvatarUseCase } from './upload-avatar.use-case.js';
import type { IAvatarRepository } from '../../domain/ports/avatar-repository.port.js';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import { AvatarEntity } from '../../domain/entities/avatar.entity.js';

describe('UploadAvatarUseCase', () => {
  let mockRepo: {
    save: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let useCase: UploadAvatarUseCase;

  beforeEach(() => {
    mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn(),
    };
    useCase = new UploadAvatarUseCase(mockRepo as unknown as IAvatarRepository);
  });

  it('deve fazer upload de uma imagem válida e retornar id e url', async () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02]);

    const result = await useCase.execute(pngBuffer);

    expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(result.url).toBe(`/api/avatars/${result.id}`);
    expect(mockRepo.save).toHaveBeenCalledOnce();

    const call = mockRepo.save.mock.calls[0];
    expect(call).toBeDefined();
    const savedAvatar = call![0] as AvatarEntity;
    expect(savedAvatar).toBeInstanceOf(AvatarEntity);
    expect(savedAvatar.id).toBe(result.id);
    expect(savedAvatar.mimeType).toBe('image/png');
    expect(savedAvatar.content).toEqual(pngBuffer);
  });

  it('deve rejeitar buffer vazio com DomainError 400 VALIDATION_ERROR sem chamar repositório', async () => {
    const empty = Buffer.alloc(0);

    await expect(useCase.execute(empty)).rejects.toThrow(DomainError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('deve rejeitar payload maior que 2 MB com DomainError 413 FILE_TOO_LARGE', async () => {
    const huge = Buffer.alloc(2 * 1024 * 1024 + 1);
    huge[0] = 0x89;
    huge[1] = 0x50;
    huge[2] = 0x4e;
    huge[3] = 0x47;

    await expect(useCase.execute(huge)).rejects.toThrow(DomainError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('deve rejeitar arquivo inválido que não seja imagem permitida', async () => {
    const textBuffer = Buffer.from('hello world, this is plain text');

    await expect(useCase.execute(textBuffer)).rejects.toThrow(DomainError);
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('deve propagar erro se o repositório falhar ao salvar', async () => {
    mockRepo.save.mockRejectedValueOnce(new Error('Database write error'));
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    await expect(useCase.execute(pngBuffer)).rejects.toThrow('Database write error');
  });
});
