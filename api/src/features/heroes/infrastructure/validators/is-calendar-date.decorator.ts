import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import {
  isCalendarDay,
  MIN_DATE_OF_BIRTH,
  todayIn,
} from '../../domain/utils/calendar-date.validator.js';

export function IsCalendarDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isCalendarDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') return false;
          const trimmed = value.trim();
          if (trimmed === '') return false;
          if (!isCalendarDay(trimmed)) return false;
          if (trimmed < MIN_DATE_OF_BIRTH) return false;
          if (trimmed > todayIn('Pacific/Kiritimati')) return false;
          return true;
        },
        defaultMessage(args: ValidationArguments): string {
          const value = args.value;
          if (typeof value !== 'string' || value.trim() === '') {
            return 'Informe a data de nascimento.';
          }
          const trimmed = value.trim();
          if (!isCalendarDay(trimmed)) {
            return 'Use uma data válida no formato AAAA-MM-DD.';
          }
          if (trimmed < MIN_DATE_OF_BIRTH) {
            return 'A data de nascimento deve ser a partir do ano 1000.';
          }
          if (trimmed > todayIn('Pacific/Kiritimati')) {
            return 'A data de nascimento não pode ser no futuro.';
          }
          return 'Informe a data de nascimento.';
        },
      },
    });
  };
}
