import {
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

const ISO_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:?\d{2})$/;

export function IsIsoDateTime(
  label: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isIsoDateTime',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          const trimmed = value.trim();
          if (!ISO_DATETIME_REGEX.test(trimmed)) return false;
          const date = new Date(trimmed);
          return !isNaN(date.getTime());
        },
        defaultMessage(): string {
          return `Informe a data e hora de ${label} em formato ISO 8601.`;
        },
      },
    });
  };
}
