import 'reflect-metadata';
import type { LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { InjectOptions, Response as LightMyRequestResponse } from 'light-my-request';
import type { Pool } from 'mysql2/promise';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './core/observability/http-exception.filter.js';
import { createValidationPipe } from './core/security/validation-pipe.factory.js';
import { StartCsvImportUseCase } from './features/imports/index.js';

export interface AppInstance {
  readonly app: NestExpressApplication;
  readonly imports: StartCsvImportUseCase;
  inject(opts: InjectOptions | string): Promise<LightMyRequestResponse>;
  close(): Promise<void>;
}

export interface CreateNestAppOptions {
  readonly logger?: LogLevel[] | false;
}

export async function createNestApp(
  pool?: Pool,
  instanceId = process.env.INSTANCE_ID ?? 'api-local',
  options?: CreateNestAppOptions,
): Promise<AppInstance> {
  const logger: LogLevel[] | false =
    options?.logger ??
    (process.env.NODE_ENV === 'test' ? false : ['log', 'warn', 'error']);

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(pool),
    {
      logger,
      bodyParser: false,
    },
  );

  const expressApp = app.getHttpAdapter().getInstance() as express.Express;
  expressApp.disable('x-powered-by');

  expressApp.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Instance-Id', instanceId);
    next();
  });

  expressApp.use(express.json({ limit: '15mb' }));
  expressApp.use(express.text({ type: 'text/*', limit: '15mb' }));

  expressApp.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
      res.status(400).json({
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'A requisição enviada é inválida ou está malformada.',
          fields: [{ field: 'body', message: 'Verifique os dados enviados.' }],
        },
      });
      return;
    }
    if (
      typeof err === 'object' &&
      err !== null &&
      (('type' in err && (err as { type: unknown }).type === 'entity.too.large') ||
        ('status' in err && (err as { status: unknown }).status === 413))
    ) {
      res.status(413).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'O arquivo ou payload enviado excede o tamanho máximo permitido.',
          fields: [{ field: 'file', message: 'Arquivo ou payload muito grande.' }],
        },
      });
      return;
    }
    next(err);
  });

  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();

  const imports = app.get(StartCsvImportUseCase);

  return {
    app,
    imports,
    inject: async (opts: InjectOptions | string) => {
      const { default: lightMyRequest } = await import('light-my-request');
      return lightMyRequest(
        expressApp as unknown as Parameters<typeof lightMyRequest>[0],
        opts,
      );
    },
    close: async () => {
      await imports.waitForAll();
      await app.close();
    },
  };
}
