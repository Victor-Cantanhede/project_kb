import type { Pool } from 'mysql2/promise';
import { AvatarService } from './application/avatar-service.js';
import { MysqlAvatarRepository } from './infrastructure/mysql-avatar-repository.js';

export {
  ALLOWED_AVATAR_MIMES,
  detectImageMimeType,
  MAX_AVATAR_BYTES,
  toAvatarId,
  type AvatarId,
  type AvatarMimeType,
  type AvatarRecord,
} from './domain/avatar.js';
export { AvatarService } from './application/avatar-service.js';
export type { AvatarRepository } from './application/ports.js';
export { registerAvatarRoutes } from './infrastructure/http.js';

export function createAvatarsModule(pool: Pool): AvatarService {
  const repo = new MysqlAvatarRepository(pool);
  return new AvatarService(repo);
}

