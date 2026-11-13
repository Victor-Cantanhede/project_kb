import { Controller, Get, Inject } from '@nestjs/common';
import { HealthService } from './health.service.js';
import type { HealthResponseDto } from './dto/health-response.dto.js';

@Controller(['health', 'api/health'])
export class HealthController {
  constructor(
    @Inject(HealthService)
    private readonly healthService: HealthService,
  ) {}

  @Get()
  async check(): Promise<HealthResponseDto> {
    return this.healthService.check();
  }
}
