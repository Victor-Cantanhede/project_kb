import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

const AVATAR_UPLOAD_PATH = /^\/api\/avatars\/[0-9a-f-]{36}$/;

export function isValidAvatarUrl(value: string): boolean {
  if (AVATAR_UPLOAD_PATH.test(value)) return true;
  if (!URL.canParse(value)) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

export function IsValidAvatarUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isValidAvatarUrl',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (value === null || value === undefined) return true;
          if (typeof value !== 'string') return false;
          const trimmed = value.trim();
          if (trimmed === '') return true;
          if (trimmed.length > 2048) return false;
          return isValidAvatarUrl(trimmed);
        },
        defaultMessage(args: ValidationArguments): string {
          const value = args.value;
          if (typeof value === 'string' && value.trim().length > 2048) {
            return 'Use no máximo 2048 caracteres.';
          }
          return 'Informe uma URL http(s) válida.';
        },
      },
    });
  };
}
