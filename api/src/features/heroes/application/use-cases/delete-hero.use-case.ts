import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../../../../core/errors/domain.exception.js';
import { MysqlTransactionManager } from '../../../../core/database/mysql-transaction.manager.js';
import {
  HERO_REPOSITORY_TOKEN,
  type IHeroRepository,
} from '../../domain/ports/hero-repository.port.js';
import { validateHeroId } from './update-hero.use-case.js';

@Injectable()
export class DeleteHeroUseCase {
  constructor(
    @Inject(HERO_REPOSITORY_TOKEN)
    private readonly heroRepository: IHeroRepository,
    @Inject(MysqlTransactionManager)
    private readonly txManager: MysqlTransactionManager,
  ) {}

  async execute(id: string): Promise<void> {
    validateHeroId(id);

    await this.txManager.run(async (tx) => {
      const current = await this.heroRepository.lockById(tx, id);
      if (!current) {
        throw new DomainError('not_found', 'HERO_NOT_FOUND', 'Herói não encontrado.');
      }
      await this.heroRepository.softDelete(tx, id);
    });
  }
}
