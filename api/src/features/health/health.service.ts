import { Inject, Injectable } from '@nestjs/common';
import { MysqlDatabaseService } from '../../core/database/mysql-database.service.js';
import type { HealthResponseDto } from './dto/health-response.dto.js';

@Injectable()
export class HealthService {
  constructor(
    @Inject(MysqlDatabaseService)
    private readonly db: MysqlDatabaseService,
  ) {}

  async check(): Promise<HealthResponseDto> {
    await this.db.execute(this.db.getPool(), 'SELECT 1');
    const instanceId = process.env.INSTANCE_ID ?? 'api-local';
    return {
      status: 'ok',
      instance: instanceId,
    };
  }
}
