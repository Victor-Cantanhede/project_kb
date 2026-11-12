import type { FastifyInstance } from 'fastify';
import { readSingleMultipartFile } from '../../../shared/infra/multipart.js';
import { validationError } from '../../../shared/kernel/errors.js';
import type { AvatarService } from '../application/avatar-service.js';

export function registerAvatarRoutes(app: FastifyInstance, service: AvatarService): void {
  app.post('/avatars', async (req, reply) => {
    if (!req.isMultipart()) {
      throw validationError([{ field: 'file', message: 'Envie a imagem via multipart/form-data.' }]);
    }
    const file = await readSingleMultipartFile(req, 'Nenhum arquivo de imagem enviado.');
    const uploaded = await service.upload(file.buffer);
    return reply.status(201).send(uploaded);
  });

  app.get<{ Params: { id: string } }>('/avatars/:id', async (req, reply) => {
    const avatar = await service.getById(req.params.id);
    return reply
      .header('Content-Type', avatar.mime_type)
      .header('X-Content-Type-Options', 'nosniff')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(avatar.content);
  });
}

