import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GetAvatarUseCase } from './get-avatar.use-case.js';
import type { IAvatarRepository } from '../../domain/ports/avatar-repository.port.js';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import { AvatarEntity } from '../../domain/entities/avatar.entity.js';

describe('GetAvatarUseCase', () => {
  let mockRepo: {
    save: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let useCase: GetAvatarUseCase;

  beforeEach(() => {
    mockRepo = {
      save: vi.fn(),
      findById: vi.fn(),
    };
    useCase = new GetAvatarUseCase(mockRepo as unknown as IAvatarRepository);
  });

  it('deve retornar AvatarEntity quando o id for um UUID válido e existir no banco', async () => {
    const validId = '11111111-2222-4333-8444-555555555555';
    const fakeAvatar = new AvatarEntity({
      id: validId,
      mimeType: 'image/png',
      content: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      createdAt: new Date(),
    });
    mockRepo.findById.mockResolvedValueOnce(fakeAvatar);

    const result = await useCase.execute(validId);

    expect(result).toBe(fakeAvatar);
    expect(mockRepo.findById).toHaveBeenCalledWith(validId);
  });

  it('deve lançar 400 VALIDATION_ERROR no campo id se o id fornecido não for um UUID válido', async () => {
    const invalidIds = ['not-a-uuid', '123', '', 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz'];

    for (const invalidId of invalidIds) {
      await expect(useCase.execute(invalidId)).rejects.toThrow(DomainError);
      try {
        await useCase.execute(invalidId);
      } catch (err) {
        expect(err).toBeInstanceOf(DomainError);
        const domainErr = err as DomainError;
        expect(domainErr.kind).toBe('validation');
        expect(domainErr.code).toBe('VALIDATION_ERROR');
        expect(domainErr.extra.fields).toEqual([
          { field: 'id', message: 'Identificador de avatar inválido.' },
        ]);
      }
    }

    expect(mockRepo.findById).not.toHaveBeenCalled();
  });

  it('deve lançar 404 AVATAR_NOT_FOUND se o avatar não for encontrado no repositório', async () => {
    const validId = '11111111-2222-4333-8444-555555555555';
    mockRepo.findById.mockResolvedValueOnce(null);

    await expect(useCase.execute(validId)).rejects.toThrow(DomainError);

    try {
      await useCase.execute(validId);
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.kind).toBe('not_found');
      expect(domainErr.code).toBe('AVATAR_NOT_FOUND');
      expect(domainErr.message).toBe('Avatar não encontrado.');
    }
  });

  it('deve propagar erro se a busca no repositório falhar', async () => {
    const validId = '11111111-2222-4333-8444-555555555555';
    mockRepo.findById.mockRejectedValueOnce(new Error('Database error'));

    await expect(useCase.execute(validId)).rejects.toThrow('Database error');
  });
});
