import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError, type FieldError, statusFromKind } from '../errors/domain.exception.js';
import {
  sanitizeErrorMessage,
  sanitizeForLog,
  sanitizeLogString,
} from '../security/log-sanitizer.js';
import { formatLogPrefix, getRequestId } from './request-context.js';
import type { RequestWithContext } from './request-logger.middleware.js';

export interface ErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly fields?: readonly FieldError[];
    readonly details?: Readonly<Record<string, unknown>>;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithContext>();

    const reqId = request?.requestId || getRequestId();
    const method = sanitizeLogString(request?.method || 'UNKNOWN');
    const rawPath = (request?.originalUrl || request?.url || '/').split('?')[0] ?? '/';
    const safePath = sanitizeLogString(rawPath);
    const userPart = request?.user?.id ? ` | userId=${sanitizeLogString(request.user.id)}` : '';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorEnvelope: ErrorEnvelope;

    if (exception instanceof DomainError) {
      status = statusFromKind(exception.kind);
      errorEnvelope = {
        error: {
          code: exception.code,
          message: exception.message,
          ...(exception.extra.fields && exception.extra.fields.length > 0
            ? { fields: exception.extra.fields }
            : {}),
          ...(exception.extra.details ? { details: exception.extra.details } : {}),
        },
      };
    } else if (
      exception instanceof SyntaxError &&
      'status' in exception &&
      exception.status === 400 &&
      'body' in exception
    ) {
      // Express body-parser malformed JSON syntax error
      status = HttpStatus.BAD_REQUEST;
      errorEnvelope = {
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'A requisição enviada é inválida ou está malformada.',
          fields: [{ field: 'body', message: 'Verifique os dados enviados.' }],
        },
      };
    } else if (
      typeof exception === 'object' &&
      exception !== null &&
      (('type' in exception && (exception as { type: unknown }).type === 'entity.too.large') ||
        ('status' in exception && (exception as { status: unknown }).status === 413))
    ) {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      errorEnvelope = {
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'O arquivo ou payload enviado excede o tamanho máximo permitido.',
          fields: [{ field: 'file', message: 'Arquivo ou payload muito grande.' }],
        },
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null && 'error' in res && typeof (res as { error: unknown }).error === 'object') {
        errorEnvelope = res as ErrorEnvelope;
      } else if (status === HttpStatus.NOT_FOUND) {
        errorEnvelope = {
          error: {
            code: 'ROUTE_NOT_FOUND',
            message: 'Rota não encontrada.',
          },
        };
      } else if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
        errorEnvelope = {
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'O arquivo ou payload enviado excede o tamanho máximo permitido.',
            fields: [{ field: 'file', message: 'Arquivo ou payload muito grande.' }],
          },
        };
      } else if (status === HttpStatus.TOO_MANY_REQUESTS) {
        errorEnvelope = {
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Muitas requisições em um curto intervalo. Aguarde alguns instantes e tente novamente.',
          },
        };
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        const code = typeof resObj.code === 'string' ? resObj.code : status === 409 ? 'CONFLICT' : 'HTTP_ERROR';
        const message = typeof resObj.message === 'string' ? resObj.message : exception.message;
        const fields = Array.isArray(resObj.fields) ? (resObj.fields as FieldError[]) : undefined;
        const details = typeof resObj.details === 'object' && resObj.details !== null ? (resObj.details as Record<string, unknown>) : undefined;

        errorEnvelope = {
          error: {
            code,
            message,
            ...(fields ? { fields } : {}),
            ...(details ? { details } : {}),
          },
        };
      } else {
        errorEnvelope = {
          error: {
            code: status === 409 ? 'CONFLICT' : 'HTTP_ERROR',
            message: typeof res === 'string' ? res : exception.message,
          },
        };
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorEnvelope = {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Ocorreu um erro interno no servidor. Tente novamente em instantes.',
        },
      };
    }

    const rawDetail = JSON.stringify(sanitizeForLog(errorEnvelope));
    const detail = sanitizeErrorMessage(rawDetail);
    const logLine = `${formatLogPrefix(reqId)} HTTP ${status} ${method} ${safePath}${userPart} | detail=${detail}`;

    if (status >= 500) {
      const sanitizedStack = exception instanceof Error && exception.stack ? sanitizeErrorMessage(exception.stack) : undefined;
      this.logger.error(logLine, sanitizedStack);
    } else {
      this.logger.warn(logLine);
    }

    if (response && !response.headersSent && typeof response.status === 'function') {
      response.status(status).json(errorEnvelope);
    }
  }
}
