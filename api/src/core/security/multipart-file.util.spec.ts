import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import type { Request } from 'express';
import { DomainError } from '../errors/domain.exception.js';
import { readSingleMultipartFile } from './multipart-file.util.js';

function createMultipartStream(
  parts: Array<{ name: string; filename?: string; content: string | Buffer; isFile?: boolean }>,
  boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW',
): { stream: Request; boundary: string } {
  const chunks: Buffer[] = [];

  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (part.isFile) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename || 'file.txt'}"\r\nContent-Type: text/plain\r\n\r\n`,
        ),
      );
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n`));
    }
    chunks.push(typeof part.content === 'string' ? Buffer.from(part.content) : part.content);
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  const readable = Readable.from([Buffer.concat(chunks)]) as unknown as Request;
  readable.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
  };

  return { stream: readable, boundary };
}

describe('readSingleMultipartFile (Unit Test)', () => {
  it('deve extrair arquivo único com sucesso', async () => {
    const { stream } = createMultipartStream([
      { name: 'file', filename: 'test.png', content: 'fake-png-content', isFile: true },
    ]);

    const result = await readSingleMultipartFile(stream, 'Arquivo obrigatório.');
    expect(result.filename).toBe('test.png');
    expect(result.buffer.toString()).toBe('fake-png-content');
  });

  it('deve rejeitar requisição sem header multipart/form-data com 400 INVALID_PAYLOAD', async () => {
    const fakeReq = Readable.from([]) as unknown as Request;
    fakeReq.headers = { 'content-type': 'application/json' };

    await expect(readSingleMultipartFile(fakeReq)).rejects.toThrowError(DomainError);
    const fakeReq2 = Readable.from([]) as unknown as Request;
    fakeReq2.headers = { 'content-type': 'application/json' };
    try {
      await readSingleMultipartFile(fakeReq2);
    } catch (err) {
      expect((err as DomainError).code).toBe('INVALID_PAYLOAD');
      expect((err as DomainError).kind).toBe('validation');
    }
  });

  it('deve rejeitar upload sem arquivos com 400 VALIDATION_ERROR e mensagem customizada', async () => {
    const { stream } = createMultipartStream([
      { name: 'text_field', content: 'hello world', isFile: false },
    ]);

    try {
      await readSingleMultipartFile(stream, 'O CSV é obrigatório.');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.code).toBe('VALIDATION_ERROR');
      expect(domainErr.kind).toBe('validation');
      expect(domainErr.extra.fields).toEqual([{ field: 'file', message: 'O CSV é obrigatório.' }]);
    }
  });

  it('deve rejeitar arquivo acima do tamanho máximo com 413 FILE_TOO_LARGE', async () => {
    const bigContent = 'x'.repeat(1024 * 100); // 100 KB
    const { stream } = createMultipartStream([
      { name: 'file', filename: 'large.bin', content: bigContent, isFile: true },
    ]);

    const maxBytes = 10 * 1024; // 10 KB limit
    try {
      await readSingleMultipartFile(stream, 'Arquivo obrigatório.', maxBytes);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.kind).toBe('payload_too_large');
      expect(domainErr.code).toBe('FILE_TOO_LARGE');
      expect(domainErr.extra.fields).toEqual([{ field: 'file', message: 'Arquivo ou payload muito grande.' }]);
    }
  });

  it('deve rejeitar requisição com mais de um arquivo com 400 INVALID_PAYLOAD', async () => {
    const { stream } = createMultipartStream([
      { name: 'file1', filename: 'first.png', content: 'abc', isFile: true },
      { name: 'file2', filename: 'second.png', content: 'def', isFile: true },
    ]);

    try {
      await readSingleMultipartFile(stream);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.code).toBe('INVALID_PAYLOAD');
      expect(domainErr.kind).toBe('validation');
    }
  });

  it('deve rejeitar tentativa de poluição de protótipo em campos com 400 INVALID_PAYLOAD', async () => {
    const { stream } = createMultipartStream([
      { name: '__proto__', content: 'evil', isFile: false },
      { name: 'file', filename: 'avatar.png', content: 'good', isFile: true },
    ]);

    try {
      await readSingleMultipartFile(stream);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.code).toBe('INVALID_PAYLOAD');
      expect(domainErr.kind).toBe('validation');
    }
  });

  it('deve aceitar arquivo com tamanho exatamente igual a maxBytes', async () => {
    const exactBytes = 1024;
    const content = Buffer.alloc(exactBytes, 'a');
    const { stream } = createMultipartStream([
      { name: 'file', filename: 'exact.bin', content, isFile: true },
    ]);

    const result = await readSingleMultipartFile(stream, 'Arquivo obrigatório.', exactBytes);
    expect(result.filename).toBe('exact.bin');
    expect(result.buffer.length).toBe(exactBytes);
  });

  it('deve rejeitar arquivo com maxBytes + 1 byte com 413 FILE_TOO_LARGE', async () => {
    const limitBytes = 1024;
    const content = Buffer.alloc(limitBytes + 1, 'a');
    const { stream } = createMultipartStream([
      { name: 'file', filename: 'over.bin', content, isFile: true },
    ]);

    try {
      await readSingleMultipartFile(stream, 'Arquivo obrigatório.', limitBytes);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.code).toBe('FILE_TOO_LARGE');
      expect(domainErr.kind).toBe('payload_too_large');
    }
  });

  it('deve rejeitar e falhar imediatamente quando a requisição emitir erro na stream', async () => {
    const req = new Readable({ read() {} }) as unknown as Request;
    req.headers = {
      'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
    };

    const promise = readSingleMultipartFile(req);
    req.emit('error', new Error('Client connection reset'));

    await expect(promise).rejects.toMatchObject({
      code: 'INVALID_PAYLOAD',
      kind: 'validation',
    });
  });

  it('deve rejeitar e falhar imediatamente quando a requisição emitir evento aborted', async () => {
    const req = new Readable({ read() {} }) as unknown as Request;
    req.headers = {
      'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
    };

    const promise = readSingleMultipartFile(req);
    req.emit('aborted');

    await expect(promise).rejects.toMatchObject({
      code: 'INVALID_PAYLOAD',
      kind: 'validation',
    });
  });

  it('deve rejeitar arquivo cujo field name é __proto__, constructor ou prototype com 400 INVALID_PAYLOAD', async () => {
    const { stream } = createMultipartStream([
      { name: '__proto__', filename: 'malicious.png', content: 'payload', isFile: true },
    ]);

    try {
      await readSingleMultipartFile(stream);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.code).toBe('INVALID_PAYLOAD');
      expect(domainErr.kind).toBe('validation');
    }
  });

  it('deve rejeitar com INVALID_PAYLOAD quando a requisição for abortada via req.destroy()', async () => {
    const req = new Readable({ read() {} }) as unknown as Request;
    req.headers = {
      'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
    };

    const promise = readSingleMultipartFile(req);
    (req as any).destroy();

    await expect(promise).rejects.toMatchObject({
      code: 'INVALID_PAYLOAD',
      kind: 'validation',
    });
  });

  it('deve aceitar content-type multipart/form-data com maiúsculas/minúsculas mistas (RFC 9110)', async () => {
    const { stream, boundary } = createMultipartStream([
      { name: 'file', filename: 'mixed-case.txt', content: 'test-mixed', isFile: true },
    ]);
    stream.headers['content-type'] = `Multipart/Form-Data; boundary=${boundary}`;

    const result = await readSingleMultipartFile(stream);
    expect(result.filename).toBe('mixed-case.txt');
    expect(result.buffer.toString()).toBe('test-mixed');
  });
});
