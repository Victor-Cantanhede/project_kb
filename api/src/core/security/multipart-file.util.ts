import type { Request } from 'express';
import busboy from 'busboy';
import { DomainError } from '../errors/domain.exception.js';

export interface UploadedFile {
  readonly filename: string;
  readonly buffer: Buffer;
  readonly mimeType?: string;
}

export async function readSingleMultipartFile(
  req: Request,
  missingMessage = 'O arquivo é obrigatório.',
  maxBytes = 15 * 1024 * 1024,
): Promise<UploadedFile> {
  const contentType = (req.headers && req.headers['content-type']) || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    throw new DomainError('validation', 'INVALID_PAYLOAD', 'A requisição enviada é inválida ou está malformada.', {
      fields: [{ field: 'body', message: 'Verifique os dados enviados.' }],
    });
  }

  return new Promise<UploadedFile>((resolve, reject) => {
    let bb: busboy.Busboy;
    try {
      bb = busboy({
        headers: req.headers,
        limits: {
          files: 2, // Allow detecting if a second file was attempted
          fileSize: maxBytes + 1,
        },
      });
    } catch {
      return reject(
        new DomainError('validation', 'INVALID_PAYLOAD', 'A requisição enviada é inválida ou está malformada.', {
          fields: [{ field: 'body', message: 'Verifique os dados enviados.' }],
        }),
      );
    }

    let fileCount = 0;
    let fileUploaded: UploadedFile | null = null;
    let fileTooLarge = false;
    let settled = false;

    const onReqError = () => {
      fail(
        new DomainError('validation', 'INVALID_PAYLOAD', 'A requisição enviada é inválida ou está malformada.', {
          fields: [{ field: 'body', message: 'Verifique os dados enviados.' }],
        }),
      );
    };

    const onReqClose = () => {
      if (!settled && !req.readableEnded) {
        onReqError();
      }
    };

    req.on?.('error', onReqError);
    req.on?.('aborted', onReqError);
    req.on?.('close', onReqClose);

    const cleanup = () => {
      settled = true;
      req.removeListener?.('error', onReqError);
      req.removeListener?.('aborted', onReqError);
      req.removeListener?.('close', onReqClose);
      try {
        req.unpipe?.(bb);
      } catch {
        // ignore unpipe errors
      }
    };

    const fail = (error: Error) => {
      if (settled) return;
      cleanup();
      reject(error);
    };

    bb.on('field', (name) => {
      if (name === '__proto__' || name === 'constructor' || name === 'prototype') {
        fail(
          new DomainError('validation', 'INVALID_PAYLOAD', 'A requisição enviada é inválida ou está malformada.', {
            fields: [{ field: 'body', message: 'Verifique os dados enviados.' }],
          }),
        );
      }
    });

    bb.on('file', (name, fileStream, info) => {
      if (name === '__proto__' || name === 'constructor' || name === 'prototype') {
        fileStream.resume();
        return fail(
          new DomainError('validation', 'INVALID_PAYLOAD', 'A requisição enviada é inválida ou está malformada.', {
            fields: [{ field: 'body', message: 'Verifique os dados enviados.' }],
          }),
        );
      }

      fileCount += 1;
      if (fileCount > 1) {
        fileStream.resume(); // drain
        return fail(
          new DomainError('validation', 'INVALID_PAYLOAD', 'A requisição enviada é inválida ou está malformada.', {
            fields: [{ field: 'body', message: 'Verifique os dados enviados.' }],
          }),
        );
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      fileStream.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          fileTooLarge = true;
          fileStream.resume(); // drain remaining
        } else {
          chunks.push(chunk);
        }
      });

      fileStream.on('limit', () => {
        fileTooLarge = true;
      });

      fileStream.on('error', () => {
        fail(
          new DomainError('validation', 'INVALID_PAYLOAD', 'A requisição enviada é inválida ou está malformada.', {
            fields: [{ field: 'body', message: 'Verifique os dados enviados.' }],
          }),
        );
      });

      fileStream.on('end', () => {
        if (!fileTooLarge) {
          fileUploaded = {
            filename: info.filename || 'unknown',
            buffer: Buffer.concat(chunks),
            mimeType: info.mimeType,
          };
        }
      });
    });

    bb.on('error', () => {
      fail(
        new DomainError('validation', 'INVALID_PAYLOAD', 'A requisição enviada é inválida ou está malformada.', {
          fields: [{ field: 'body', message: 'Verifique os dados enviados.' }],
        }),
      );
    });

    bb.on('close', () => {
      if (settled) return;
      if (fileTooLarge) {
        return fail(
          new DomainError(
            'payload_too_large',
            'FILE_TOO_LARGE',
            'O arquivo ou payload enviado excede o tamanho máximo permitido.',
            {
              fields: [{ field: 'file', message: 'Arquivo ou payload muito grande.' }],
            },
          ),
        );
      }
      if (!fileUploaded) {
        return fail(
          new DomainError('validation', 'VALIDATION_ERROR', 'Alguns campos estão inválidos.', {
            fields: [{ field: 'file', message: missingMessage }],
          }),
        );
      }
      cleanup();
      resolve(fileUploaded);
    });

    req.pipe(bb);
  });
}
