import { describe, expect, it, vi } from 'vitest';
import {
  type ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { DomainError } from '../errors/domain.exception.js';
import { HttpExceptionFilter } from './http-exception.filter.js';

function createMockHost() {
  let capturedStatus = 0;
  let capturedJson: unknown = null;

  const mockResponse = {
    headersSent: false,
    status: (code: number) => {
      capturedStatus = code;
      return mockResponse;
    },
    json: (body: unknown) => {
      capturedJson = body;
      return mockResponse;
    },
  };

  const mockRequest = {
    method: 'GET',
    url: '/heroes/123',
    originalUrl: '/heroes/123',
    headers: {},
  };

  const host: ArgumentsHost = {
    switchToHttp: () => ({
      getResponse: () => mockResponse as any,
      getRequest: () => mockRequest as any,
      getNext: () => ({}) as any,
    }),
    getArgs: () => [] as any,
    getArgByIndex: () => ({}) as any,
    switchToRpc: () => ({}) as any,
    switchToWs: () => ({}) as any,
    getType: () => 'http' as any,
  };

  return {
    host,
    getStatus: () => capturedStatus,
    getJson: () => capturedJson as { error: { code: string; message: string; fields?: any[]; details?: any } },
  };
}

describe('HttpExceptionFilter (Unit Test)', () => {
  it('deve formatar DomainError com fields e details no envelope padrão', () => {
    const filter = new HttpExceptionFilter();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    // Validation error
    const validationMock = createMockHost();
    const domainValidationErr = new DomainError('validation', 'VALIDATION_ERROR', 'Campos inválidos', {
      fields: [{ field: 'name', message: 'Nome é obrigatório.' }],
    });
    filter.catch(domainValidationErr, validationMock.host);
    expect(validationMock.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(validationMock.getJson()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Campos inválidos',
        fields: [{ field: 'name', message: 'Nome é obrigatório.' }],
      },
    });

    // Conflict error with details
    const conflictMock = createMockHost();
    const domainConflictErr = new DomainError('conflict', 'HERO_VERSION_CONFLICT', 'Versão desatualizada.', {
      details: { current_hero: { id: 'hero-1', version: 2 } },
    });
    filter.catch(domainConflictErr, conflictMock.host);
    expect(conflictMock.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(conflictMock.getJson()).toEqual({
      error: {
        code: 'HERO_VERSION_CONFLICT',
        message: 'Versão desatualizada.',
        details: { current_hero: { id: 'hero-1', version: 2 } },
      },
    });
  });

  it('deve formatar erro de sintaxe do body-parser (JSON malformado) como 400 INVALID_PAYLOAD', () => {
    const filter = new HttpExceptionFilter();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    const mock = createMockHost();
    const syntaxError = new SyntaxError('Unexpected token in JSON at position 5') as any;
    syntaxError.status = 400;
    syntaxError.body = '{"bad: ';

    filter.catch(syntaxError, mock.host);
    expect(mock.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(mock.getJson()).toEqual({
      error: {
        code: 'INVALID_PAYLOAD',
        message: 'A requisição enviada é inválida ou está malformada.',
        fields: [{ field: 'body', message: 'Verifique os dados enviados.' }],
      },
    });
  });

  it('deve formatar erro de payload excessivo como 413 FILE_TOO_LARGE', () => {
    const filter = new HttpExceptionFilter();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    const mock = createMockHost();
    const payloadError = { type: 'entity.too.large', status: 413 };

    filter.catch(payloadError, mock.host);
    expect(mock.getStatus()).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(mock.getJson()).toEqual({
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'O arquivo ou payload enviado excede o tamanho máximo permitido.',
        fields: [{ field: 'file', message: 'Arquivo ou payload muito grande.' }],
      },
    });
  });

  it('deve formatar NotFoundException de rota como 404 ROUTE_NOT_FOUND', () => {
    const filter = new HttpExceptionFilter();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    const mock = createMockHost();
    const notFound = new NotFoundException('Cannot GET /nonexistent');

    filter.catch(notFound, mock.host);
    expect(mock.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(mock.getJson()).toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Rota não encontrada.',
      },
    });
  });

  it('deve capturar erros genéricos inesperados como 500 INTERNAL_ERROR sem vazar stack trace', () => {
    const filter = new HttpExceptionFilter();
    const errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    try {
      const mock = createMockHost();
      const crash = new Error('Database connection failed abruptly');

      filter.catch(crash, mock.host);
      expect(mock.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(mock.getJson()).toEqual({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Ocorreu um erro interno no servidor. Tente novamente em instantes.',
        },
      });
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
