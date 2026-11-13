export class HealthResponseDto {
  readonly status: 'ok' = 'ok';
  readonly instance!: string;
}
