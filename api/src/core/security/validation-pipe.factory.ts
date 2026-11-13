import { ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { DomainError, type FieldError } from '../errors/domain.exception.js';

export function flattenValidationErrors(errors: ValidationError[], parentProperty = ''): FieldError[] {
  const result: FieldError[] = [];

  for (const error of errors) {
    const property = parentProperty ? `${parentProperty}.${error.property}` : error.property;

    if (error.constraints) {
      const messages = Object.values(error.constraints);
      if (messages.length > 0 && messages[0]) {
        result.push({
          field: property,
          message: messages[0],
        });
      }
    }

    if (error.children && error.children.length > 0) {
      result.push(...flattenValidationErrors(error.children, property));
    }
  }

  return result;
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
    exceptionFactory: (errors: ValidationError[]) => {
      const fieldErrors = flattenValidationErrors(errors);
      return new DomainError('validation', 'VALIDATION_ERROR', 'Alguns campos estão inválidos.', {
        fields: fieldErrors,
      });
    },
  });
}
