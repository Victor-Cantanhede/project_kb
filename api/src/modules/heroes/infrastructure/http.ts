import type { FastifyInstance } from 'fastify';
import type { HeroService } from '../application/hero-service.js';

function headerString(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.[0];
}

export function registerHeroRoutes(app: FastifyInstance, service: HeroService): void {
  app.get('/heroes', async (req) => service.list(req.query));

  app.get<{ Params: { id: string } }>('/heroes/:id', async (req) => service.getById(req.params.id));

  app.post('/heroes', async (req, reply) => {
    const result = await service.create(req.body, {
      idempotencyKey: headerString(req.headers['idempotency-key']),
      timeZone: headerString(req.headers['x-timezone']),
    });
    return reply.status(result.created ? 201 : 200).send(result.hero);
  });

  app.patch<{ Params: { id: string } }>('/heroes/:id', async (req) =>
    service.update(req.params.id, req.body, headerString(req.headers['x-timezone'])),
  );

  app.post<{ Params: { id: string } }>('/heroes/:id/activate', async (req) =>
    service.setActive(req.params.id, true),
  );

  app.post<{ Params: { id: string } }>('/heroes/:id/deactivate', async (req) =>
    service.setActive(req.params.id, false),
  );

  app.delete<{ Params: { id: string } }>('/heroes/:id', async (req, reply) => {
    await service.remove(req.params.id);
    return reply.status(204).send();
  });

  app.get<{ Params: { id: string } }>('/heroes/:id/history', async (req) =>
    service.listHistory(req.params.id, req.query),
  );
}

