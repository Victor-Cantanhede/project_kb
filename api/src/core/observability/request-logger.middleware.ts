import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { sanitizeLogString } from '../security/log-sanitizer.js';
import { formatLogPrefix, runWithRequestContext } from './request-context.js';

const VALID_REQUEST_ID_REGEX = /^[A-Za-z0-9_-]{4,36}$/;

export interface RequestWithContext extends Request {
  requestId?: string;
  user?: {
    id?: string;
    role?: string;
    name?: string;
    email?: string;
  };
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  use(req: RequestWithContext, res: Response, next: NextFunction): void {
    const rawHeader = req.headers['x-request-id'];
    const headerCandidate = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    const reqId =
      typeof headerCandidate === 'string' && VALID_REQUEST_ID_REGEX.test(headerCandidate.trim())
        ? headerCandidate.trim().slice(0, 12)
        : randomUUID().slice(0, 8);

    req.requestId = reqId;
    res.setHeader('X-Request-Id', reqId);

    const rawPath = (req.originalUrl || req.url || '/').split('?')[0] ?? '/';
    const safePath = sanitizeLogString(rawPath);
    const safeMethod = sanitizeLogString(req.method || 'GET');
    const startTime = Date.now();

    runWithRequestContext({ reqId, method: safeMethod, path: safePath }, () => {
      res.once('finish', () => {
        const durationMs = Date.now() - startTime;
        const statusCode = res.statusCode;
        const userIdPart = req.user?.id ? ` userId=${sanitizeLogString(req.user.id)}` : '';
        const rolePart = req.user?.role ? ` role=${sanitizeLogString(req.user.role)}` : '';
        const logLine = `${formatLogPrefix(reqId)} ${safeMethod} ${safePath} | status=${statusCode} durationMs=${durationMs}${userIdPart}${rolePart}`;

        const isHealthRoute = safePath === '/api/health' || safePath === '/health';
        if (isHealthRoute && statusCode < 400 && durationMs < 500) {
          this.logger.debug(logLine);
          return;
        }

        if (statusCode >= 500) {
          this.logger.error(logLine);
        } else if (statusCode >= 400 || (isHealthRoute && durationMs >= 500)) {
          this.logger.warn(logLine);
        } else {
          this.logger.log(logLine);
        }
      });

      next();
    });
  }
}
