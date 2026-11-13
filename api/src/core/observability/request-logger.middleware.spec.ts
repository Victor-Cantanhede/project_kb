import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { RequestLoggerMiddleware, type RequestWithContext } from './request-logger.middleware.js';
import { getRequestId } from './request-context.js';

function createMockReqRes(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  statusCode?: number;
  user?: { id?: string; role?: string };
}) {
  const req = {
    method: options.method || 'GET',
    url: options.url || '/api/heroes',
    originalUrl: options.url || '/api/heroes',
    headers: options.headers || {},
    user: options.user,
  } as unknown as RequestWithContext;

  const responseHeaders: Record<string, string> = {};
  const res = new EventEmitter() as EventEmitter & {
    statusCode: number;
    setHeader: (name: string, value: string) => void;
  };
  res.statusCode = options.statusCode ?? 200;
  res.setHeader = (name: string, value: string) => {
    responseHeaders[name.toLowerCase()] = value;
  };

  return { req, res, responseHeaders };
}

describe('RequestLoggerMiddleware (Unit Test)', () => {
  it('deve gerar reqId quando X-Request-Id estiver ausente e propagar via AsyncLocalStorage', () => {
    const middleware = new RequestLoggerMiddleware();
    const { req, res, responseHeaders } = createMockReqRes({
      method: 'POST',
      url: '/api/heroes',
    });

    const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    try {
      let insideContextReqId = '';
      middleware.use(req, res as any, () => {
        insideContextReqId = getRequestId();
      });

      expect(req.requestId).toBeDefined();
      expect(req.requestId!.length).toBe(8);
      expect(responseHeaders['x-request-id']).toBe(req.requestId);
      expect(insideContextReqId).toBe(req.requestId);
      expect(getRequestId()).toBe('-');

      res.emit('finish');
      expect(logSpy).toHaveBeenCalledTimes(1);
      const callArg = logSpy.mock.calls[0]![0];
      expect(callArg).toContain(`[req:${req.requestId}] POST /api/heroes`);
      expect(callArg).toContain('status=200 durationMs=');
    } finally {
      logSpy.mockRestore();
    }
  });

  it('deve aceitar X-Request-Id válido (truncado a 12 chars) e rejeitar header malformado com CRLF', () => {
    const middleware = new RequestLoggerMiddleware();
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    const valid = createMockReqRes({
      headers: { 'x-request-id': 'trace-1234567890' },
    });
    middleware.use(valid.req, valid.res as any, () => {});
    expect(valid.req.requestId).toBe('trace-123456');
    expect(valid.responseHeaders['x-request-id']).toBe('trace-123456');

    const malicious = createMockReqRes({
      headers: { 'x-request-id': 'abc\r\nFAKE_LOG' },
    });
    middleware.use(malicious.req, malicious.res as any, () => {});
    expect(malicious.req.requestId).not.toBe('abc\r\nFAKE_LOG');
    expect(/^[A-Za-z0-9_-]{8}$/.test(malicious.req.requestId || '')).toBe(true);
  });

  it('deve rotear /api/health rápido para debug, 4xx para warn, e 5xx para error', () => {
    const middleware = new RequestLoggerMiddleware();
    const debugSpy = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    try {
      // Health check 200
      const health = createMockReqRes({ url: '/api/health', statusCode: 200 });
      middleware.use(health.req, health.res as any, () => {});
      health.res.emit('finish');
      expect(debugSpy).toHaveBeenCalledTimes(1);

      // 404 route
      const notFound = createMockReqRes({ url: '/unknown', statusCode: 404 });
      middleware.use(notFound.req, notFound.res as any, () => {});
      notFound.res.emit('finish');
      expect(warnSpy).toHaveBeenCalledTimes(1);

      // 500 error
      const serverErr = createMockReqRes({ url: '/api/crash', statusCode: 500 });
      middleware.use(serverErr.req, serverErr.res as any, () => {});
      serverErr.res.emit('finish');
      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      debugSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
