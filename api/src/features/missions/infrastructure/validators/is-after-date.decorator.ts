import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

export function IsAfterDate(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isAfterDate',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as Record<string, unknown>)[
            relatedPropertyName
          ];

          if (typeof value !== 'string' || typeof relatedValue !== 'string') {
            return true; // Let IsIsoDateTime report invalid types/missing values
          }

          const endDate = new Date(value);
          const startDate = new Date(relatedValue);

          if (isNaN(endDate.getTime()) || isNaN(startDate.getTime())) {
            return true; // Let IsIsoDateTime report invalid formats
          }

          return endDate.getTime() > startDate.getTime();
        },
        defaultMessage(): string {
          return 'O horário de término deve ser posterior ao horário de início.';
        },
      },
    });
  };
}
