import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import {
  MAX_AVATAR_BYTES,
  validateImageMagicBytes,
} from './image-magic-bytes.validator.js';

describe('validateImageMagicBytes', () => {
  it('deve identificar imagem PNG válida', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(validateImageMagicBytes(pngBuffer)).toBe('image/png');
  });

  it('deve identificar imagem JPEG válida', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(validateImageMagicBytes(jpegBuffer)).toBe('image/jpeg');
  });

  it('deve identificar imagem WEBP válida', () => {
    const riff = Buffer.from('RIFF');
    const size = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    const webp = Buffer.from('WEBP');
    const webpBuffer = Buffer.concat([riff, size, webp, Buffer.alloc(10)]);
    expect(validateImageMagicBytes(webpBuffer)).toBe('image/webp');
  });

  it('deve identificar imagem GIF87a válida', () => {
    const gifBuffer = Buffer.from('GIF87a-payload-data');
    expect(validateImageMagicBytes(gifBuffer)).toBe('image/gif');
  });

  it('deve identificar imagem GIF89a válida', () => {
    const gifBuffer = Buffer.from('GIF89a-payload-data');
    expect(validateImageMagicBytes(gifBuffer)).toBe('image/gif');
  });

  it('deve rejeitar buffer vazio com 400 VALIDATION_ERROR no campo file', () => {
    const emptyBuffer = Buffer.alloc(0);
    expect(() => validateImageMagicBytes(emptyBuffer)).toThrow(DomainError);

    try {
      validateImageMagicBytes(emptyBuffer);
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.kind).toBe('validation');
      expect(domainErr.code).toBe('VALIDATION_ERROR');
      expect(domainErr.extra.fields).toEqual([
        { field: 'file', message: 'O arquivo de imagem está vazio.' },
      ]);
    }
  });

  it('deve aceitar imagem de exatamente 2 MB (limite superior)', () => {
    const buffer2MB = Buffer.alloc(MAX_AVATAR_BYTES);
    // Write valid PNG header
    buffer2MB[0] = 0x89;
    buffer2MB[1] = 0x50;
    buffer2MB[2] = 0x4e;
    buffer2MB[3] = 0x47;
    buffer2MB[4] = 0x0d;
    buffer2MB[5] = 0x0a;
    buffer2MB[6] = 0x1a;
    buffer2MB[7] = 0x0a;

    expect(validateImageMagicBytes(buffer2MB)).toBe('image/png');
  });

  it('deve rejeitar imagem maior que 2 MB com 413 FILE_TOO_LARGE', () => {
    const oversizedBuffer = Buffer.alloc(MAX_AVATAR_BYTES + 1);
    oversizedBuffer[0] = 0x89;
    oversizedBuffer[1] = 0x50;
    oversizedBuffer[2] = 0x4e;
    oversizedBuffer[3] = 0x47;

    expect(() => validateImageMagicBytes(oversizedBuffer)).toThrow(DomainError);

    try {
      validateImageMagicBytes(oversizedBuffer);
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.kind).toBe('payload_too_large');
      expect(domainErr.code).toBe('FILE_TOO_LARGE');
      expect(domainErr.message).toBe('A imagem deve ter no máximo 2 MB.');
      expect(domainErr.extra.fields).toEqual([
        { field: 'file', message: 'A imagem deve ter no máximo 2 MB.' },
      ]);
    }
  });

  it('deve rejeitar arquivo com formato desconhecido (ex: PDF ou texto plano)', () => {
    const pdfBuffer = Buffer.from('%PDF-1.4 header');
    expect(() => validateImageMagicBytes(pdfBuffer)).toThrow(DomainError);

    try {
      validateImageMagicBytes(pdfBuffer);
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.kind).toBe('validation');
      expect(domainErr.code).toBe('VALIDATION_ERROR');
      expect(domainErr.extra.fields).toEqual([
        { field: 'file', message: 'Formato de imagem inválido. Envie PNG, JPEG, WEBP ou GIF.' },
      ]);
    }
  });

  it('deve rejeitar buffer curto sem correspondência de cabeçalho', () => {
    const shortBuffer = Buffer.from([0x01, 0x02]);
    expect(() => validateImageMagicBytes(shortBuffer)).toThrow(DomainError);
  });
});
