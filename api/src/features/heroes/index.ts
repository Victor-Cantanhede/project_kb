export { HeroesModule } from './heroes.module.js';

// Public Facade
export { HeroFacadeService } from './application/services/hero-facade.service.js';

// Domain Entities & Tokens
export {
  HeroEntity,
  type HeroProps,
  HERO_LIMITS,
  MIN_DATE_OF_BIRTH,
  EDITABLE_FIELDS,
  HISTORY_FIELDS,
  type HistoryField,
} from './domain/entities/hero.entity.js';
export {
  HeroHistoryEntity,
  type HeroHistoryProps,
} from './domain/entities/hero-history.entity.js';

// Domain Ports
export {
  HERO_REPOSITORY_TOKEN,
  type IHeroRepository,
  type HeroCreateInput,
  type HeroBatchInsertInput,
  type HeroUpdateInput,
  type HeroListQuery,
  type HistoryQuery,
  type InsertOutcome,
  type IdempotentCreation,
} from './domain/ports/hero-repository.port.js';

// Domain Utilities
export {
  isCalendarDay,
  todayIn,
} from './domain/utils/calendar-date.validator.js';
export {
  diffHero,
  activationChange,
  type HeroChange,
} from './domain/utils/hero-diff.util.js';

// Application Use Cases
export { CreateHeroUseCase } from './application/use-cases/create-hero.use-case.js';
export { UpdateHeroUseCase, validateHeroId } from './application/use-cases/update-hero.use-case.js';
export { ListHeroesUseCase } from './application/use-cases/list-heroes.use-case.js';
export { GetHeroUseCase } from './application/use-cases/get-hero.use-case.js';
export { ToggleHeroStatusUseCase } from './application/use-cases/toggle-hero-status.use-case.js';
export { DeleteHeroUseCase } from './application/use-cases/delete-hero.use-case.js';
export { ListHeroHistoryUseCase } from './application/use-cases/list-hero-history.use-case.js';

// Infrastructure DTOs & Controller
export { CreateHeroDto } from './infrastructure/dtos/create-hero.dto.js';
export { UpdateHeroDto } from './infrastructure/dtos/update-hero.dto.js';
export { ListHeroesQueryDto } from './infrastructure/dtos/list-heroes-query.dto.js';
export { ListHeroHistoryQueryDto } from './infrastructure/dtos/list-hero-history-query.dto.js';
export { HeroResponseDto } from './infrastructure/dtos/hero-response.dto.js';
export { isValidAvatarUrl, IsValidAvatarUrl } from './infrastructure/validators/is-valid-avatar-url.decorator.js';
export { HeroesController } from './presentation/heroes.controller.js';
