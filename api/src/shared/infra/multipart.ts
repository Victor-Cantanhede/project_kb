import type { FastifyRequest } from 'fastify';
import { validationError } from '../kernel/errors.js';

export interface UploadedFile {
  readonly filename: string;
  readonly buffer: Buffer;
}

/** Reads a single uploaded multipart file while draining parts so `@fastify/multipart` enforces `files: 1`. */
export async function readSingleMultipartFile(
  req: FastifyRequest,
  missingMessage: string,
): Promise<UploadedFile> {
  let uploaded: UploadedFile | null = null;
  for await (const part of req.parts()) {
    if (part.type === 'file') {
      const buffer = await part.toBuffer();
      uploaded ??= { filename: part.filename, buffer };
    }
  }
  if (!uploaded) {
    throw validationError([{ field: 'file', message: missingMessage }]);
  }
  return uploaded;
}

