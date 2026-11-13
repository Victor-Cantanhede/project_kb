/**
 * Injection token for external MySQL Pool instance.
 * Separated into a dedicated leaf file to eliminate ESM circular dependencies.
 */
export const MYSQL_POOL_TOKEN = Symbol('MYSQL_POOL_TOKEN');
