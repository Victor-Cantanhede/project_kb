import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function IsNotBlankText(
  label: string,
  max: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isNotBlankText',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          const trimmed = value.trim();
          if (trimmed.length === 0) return false;
          if (trimmed.length > max) return false;
          if (CONTROL_CHARS.test(value)) return false;
          return true;
        },
        defaultMessage(args: ValidationArguments): string {
          const value = args.value;
          if (typeof value !== 'string' || value.trim().length === 0) {
            return `Informe ${label}.`;
          }
          if (value.trim().length > max) {
            return `Use no máximo ${max} caracteres.`;
          }
          if (CONTROL_CHARS.test(value)) {
            return 'Contém caracteres inválidos.';
          }
          return `Informe ${label}.`;
        },
      },
    });
  };
}
