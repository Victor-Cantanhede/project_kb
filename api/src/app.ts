import Fastify, { type FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import type { Pool } from 'mysql2/promise';
import { MysqlTransactionManager } from './shared/infra/db.js';
import { DomainError, type ErrorKind } from './shared/kernel/errors.js';
import { createHeroesModule, registerHeroRoutes, type HeroService } from './modules/heroes/index.js';
import { createMissionsModule, registerMissionRoutes, type MissionService } from './modules/missions/index.js';
import { createImportsModule, registerImportRoutes, type ImportService } from './modules/imports/index.js';
import { createAvatarsModule, MAX_AVATAR_BYTES, registerAvatarRoutes, type AvatarService } from './modules/avatars/index.js';

function assertUnreachable(value: never): never {
  throw new Error(`Variante não tratada: ${String(value)}`);
}

function statusFromKind(kind: ErrorKind): number {
  switch (kind) {
    case 'validation':
      return 400;
    case 'not_found':
      return 404;
    case 'conflict':
      return 409;
    case 'payload_too_large':
      return 413;
    default:
      return assertUnreachable(kind);
  }
}

export interface AppInstance {
  readonly app: FastifyInstance;
  readonly heroes: HeroService;
  readonly missions: MissionService;
  readonly imports: ImportService;
  readonly avatars: AvatarService;
}

export function buildApp(pool: Pool, instanceId = process.env.INSTANCE_ID ?? 'api-local'): AppInstance {
  const app = Fastify({ logger: false, bodyLimit: 15 * 1024 * 1024 });
  const txManager = new MysqlTransactionManager(pool);

  const heroes = createHeroesModule(pool, txManager);
  const missions = createMissionsModule(pool, txManager, heroes);
  const imports = createImportsModule(pool, heroes);
  const avatars = createAvatarsModule(pool);

  void app.register(multipart, {
    limits: {
      fileSize: Math.max(MAX_AVATAR_BYTES, 12 * 1024 * 1024),
      files: 1,
    },
  });

  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Instance-Id', instanceId);
  });

  app.setNotFoundHandler(async (_req, reply) =>
    reply.status(404).send({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Rota não encontrada.',
      },
    }),
  );

  app.setErrorHandler(async (error: unknown, _req, reply) => {
    if (error instanceof DomainError) {
      return reply.status(statusFromKind(error.kind)).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.extra.fields ? { fields: error.extra.fields } : {}),
          ...(error.extra.details ? { details: error.extra.details } : {}),
        },
      });
    }

    if (typeof error === 'object' && error !== null) {
      const fastifyCode = 'code' in error ? String(error.code) : '';
      const statusCode = 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 0;
      const errorMessage = error instanceof Error ? error.message : '';

      if (fastifyCode === 'FST_REQ_FILE_TOO_LARGE' || fastifyCode === 'FST_ERR_CTP_BODY_TOO_LARGE') {
        return reply.status(413).send({
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'O arquivo ou payload enviado excede o tamanho máximo permitido.',
            fields: [{ field: 'file', message: 'Arquivo ou payload muito grande.' }],
          },
        });
      }
      if (
        fastifyCode === 'FST_FILES_LIMIT' ||
        fastifyCode === 'FST_PARTS_LIMIT' ||
        fastifyCode === 'FST_FIELDS_LIMIT' ||
        fastifyCode === 'FST_PROTO_VIOLATION' ||
        fastifyCode === 'FST_INVALID_MULTIPART_CONTENT_TYPE' ||
        fastifyCode.startsWith('FST_ERR_CTP_') ||
        (statusCode >= 400 && statusCode < 500) ||
        errorMessage.startsWith('Multipart:') ||
        errorMessage === 'Unexpected end of multipart data' ||
        errorMessage === 'Part terminated early'
      ) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_PAYLOAD',
            message: 'A requisição enviada é inválida ou está malformada.',
            fields: [{ field: 'body', message: 'Verifique os dados enviados.' }],
          },
        });
      }
    }

    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocorreu um erro interno no servidor. Tente novamente em instantes.',
      },
    });
  });

  const registerAllRoutes = async (scope: FastifyInstance): Promise<void> => {
    scope.get('/health', async () => {
      await pool.query('SELECT 1');
      return { status: 'ok', instance: instanceId };
    });
    registerHeroRoutes(scope, heroes);
    registerMissionRoutes(scope, missions);
    registerImportRoutes(scope, imports);
    registerAvatarRoutes(scope, avatars);
  };

  void app.register(registerAllRoutes);
  void app.register(registerAllRoutes, { prefix: '/api' });

  return { app, heroes, missions, imports, avatars };
}

