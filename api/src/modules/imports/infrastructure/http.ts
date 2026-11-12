import type { FastifyInstance } from 'fastify';
import { readSingleMultipartFile } from '../../../shared/infra/multipart.js';
import { validationError } from '../../../shared/kernel/errors.js';
import type { ImportService } from '../application/import-service.js';

function headerString(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.[0];
}

export function registerImportRoutes(app: FastifyInstance, service: ImportService): void {
  app.get('/imports/heroes', async () => ({
    data: await service.listRecent(),
  }));

  app.get<{ Params: { id: string } }>('/imports/heroes/:id', async (req) =>
    service.getById(req.params.id),
  );

  app.post('/imports/heroes', async (req, reply) => {
    const timeZone = headerString(req.headers['x-timezone']);
    if (req.isMultipart()) {
      const file = await readSingleMultipartFile(req, 'Envie um arquivo CSV.');
      const job = await service.startImport(file.filename, file.buffer.toString('utf8'), timeZone);
      return reply.status(202).send(job);
    }
    if (typeof req.body === 'string') {
      const job = await service.startImport('herois.csv', req.body, timeZone);
      return reply.status(202).send(job);
    }
    if (
      typeof req.body === 'object' &&
      req.body !== null &&
      'csv' in req.body &&
      typeof req.body.csv === 'string'
    ) {
      const filename =
        'filename' in req.body && typeof req.body.filename === 'string'
          ? req.body.filename
          : 'herois.csv';
      const job = await service.startImport(filename, req.body.csv, timeZone);
      return reply.status(202).send(job);
    }
    throw validationError([{ field: 'file', message: 'Envie um arquivo CSV via multipart/form-data ou texto.' }]);
  });
}

