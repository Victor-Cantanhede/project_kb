import { DomainError, validationError } from '../../../../core/errors/domain.exception.js';
import type { AvatarMimeType } from '../entities/avatar.entity.js';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

export function validateImageMagicBytes(buffer: Buffer): AvatarMimeType {
  if (buffer.length === 0) {
    throw validationError([{ field: 'file', message: 'O arquivo de imagem está vazio.' }]);
  }

  if (buffer.length > MAX_AVATAR_BYTES) {
    throw new DomainError('payload_too_large', 'FILE_TOO_LARGE', 'A imagem deve ter no máximo 2 MB.', {
      fields: [{ field: 'file', message: 'A imagem deve ter no máximo 2 MB.' }],
    });
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  if (
    buffer.length >= 6 &&
    (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
      buffer.subarray(0, 6).toString('ascii') === 'GIF89a')
  ) {
    return 'image/gif';
  }

  throw validationError([
    { field: 'file', message: 'Formato de imagem inválido. Envie PNG, JPEG, WEBP ou GIF.' },
  ]);
}

export const detectImageMimeType = validateImageMagicBytes;
