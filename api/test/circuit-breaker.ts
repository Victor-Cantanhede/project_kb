export interface TestEnvConfig {
  readonly NODE_ENV?: string | undefined;
  readonly DATABASE_URL?: string | undefined;
  readonly DATABASE_URL_TEST?: string | undefined;
  readonly TEST_DATABASE_URL?: string | undefined;
}

/**
 * Fail-safe circuit breaker: prevents integration tests from ever touching
 * the development or production database.
 */
export function assertSafeTestDatabase(env: TestEnvConfig = process.env): string {
  const nodeEnv = env.NODE_ENV;
  const devDbUrl = env.DATABASE_URL;
  const testDbUrl = env.DATABASE_URL_TEST ?? env.TEST_DATABASE_URL;

  // 1. Absolute block against execution in production environment
  if (nodeEnv === 'production') {
    throw new Error(
      '🚨 FATAL: Execução de testes bloqueada em ambiente de PRODUÇÃO (NODE_ENV=production)',
    );
  }

  // 2. Ensure dedicated test connection string exists
  if (!testDbUrl) {
    throw new Error(
      '🚨 FATAL: DATABASE_URL_TEST não encontrada no .env. Configure uma connection string exclusiva para testes.',
    );
  }

  // 3. Ensure tests are NOT pointing to the development database
  if (devDbUrl && testDbUrl === devDbUrl) {
    throw new Error(
      '🚨 BLOQUEIO CRÍTICO: DATABASE_URL_TEST é IDÊNTICA à DATABASE_URL (Desenvolvimento)! Os testes devem usar um banco próprio.',
    );
  }

  return testDbUrl;
}

