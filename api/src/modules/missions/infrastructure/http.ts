import type { FastifyInstance } from 'fastify';
import type { MissionService } from '../application/mission-service.js';

export function registerMissionRoutes(app: FastifyInstance, service: MissionService): void {
  app.get('/missions', async (req) => service.list(req.query));

  app.get<{ Params: { id: string } }>('/heroes/:id/missions', async (req) =>
    service.listForHero(req.params.id, req.query),
  );

  app.get<{ Params: { id: string } }>('/missions/:id', async (req) => service.getById(req.params.id));

  app.post('/missions', async (req, reply) => {
    const mission = await service.create(req.body);
    return reply.status(201).send(mission);
  });

  app.post<{ Params: { id: string } }>('/missions/:id/heroes', async (req) =>
    service.assignHero(req.params.id, req.body),
  );

  app.delete<{ Params: { id: string; heroId: string } }>('/missions/:id/heroes/:heroId', async (req) =>
    service.removeHero(req.params.id, req.params.heroId),
  );

  app.post<{ Params: { id: string } }>('/missions/:id/start', async (req) => service.start(req.params.id));

  app.post<{ Params: { id: string } }>('/missions/:id/finish', async (req) =>
    service.finish(req.params.id, req.body),
  );

  app.post<{ Params: { id: string } }>('/missions/:id/cancel', async (req) => service.cancel(req.params.id));
}

