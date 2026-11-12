import { z } from 'zod';

const BASE_URL = process.env.BENCH_URL ?? 'http://localhost:8088';
const ROUNDS = 20;
const LIMIT_MS = 300;

const pageSchema = z.object({
  data: z.array(z.object({ id: z.string(), name: z.string(), nickname: z.string() })),
  next_cursor: z.string().nullable(),
});

interface Sample {
  readonly ms: number;
  readonly instance: string;
  readonly count: number;
}

async function measureOnce(path: string): Promise<Sample> {
  const startedAt = performance.now();
  const response = await fetch(`${BASE_URL}${path}`);
  const elapsedMs = performance.now() - startedAt;
  if (!response.ok) {
    throw new Error(`Falha em ${path}: HTTP ${response.status}`);
  }
  const body = pageSchema.parse(await response.json());
  return {
    ms: elapsedMs,
    instance: response.headers.get('x-instance-id') ?? 'unknown',
    count: body.data.length,
  };
}

async function runScenario(label: string, path: string): Promise<void> {
  // Warm-up call
  await measureOnce(path);

  const samples: Sample[] = [];
  for (let i = 0; i < ROUNDS; i += 1) {
    samples.push(await measureOnce(path));
  }

  const times = samples.map((s) => s.ms).sort((a, b) => a - b);
  const min = times[0] ?? 0;
  const max = times.at(-1) ?? 0;
  const avg = times.reduce((acc, cur) => acc + cur, 0) / times.length;
  const p95 = times[Math.floor(times.length * 0.95)] ?? max;
  const instances = Array.from(new Set(samples.map((s) => s.instance))).join(', ');

  console.log(
    `${label.padEnd(38)} | min: ${min.toFixed(1)}ms | avg: ${avg.toFixed(1)}ms | p95: ${p95.toFixed(1)}ms | max: ${max.toFixed(1)}ms | instâncias: [${instances}]`,
  );

  if (p95 >= LIMIT_MS) {
    throw new Error(`Meta de ${LIMIT_MS}ms violada em "${label}" (p95 = ${p95.toFixed(1)}ms)`);
  }
}

console.log(`Medindo desempenho em ${BASE_URL} (${ROUNDS} amostras por cenário, meta < ${LIMIT_MS}ms):`);
await runScenario('1. Primeira página (GET /api/heroes)', '/api/heroes?limit=10');
await runScenario('2. Busca por nome sem acento (joao)', '/api/heroes?search=joao&limit=10');
await runScenario('3. Busca por apelido (relampago)', '/api/heroes?search=relampago&limit=10');
await runScenario('4. Busca rara em 100k (Relampago 1)', '/api/heroes?search=Relampago%201&limit=10');
await runScenario('5. Busca sem resultado em 100k', '/api/heroes?search=heroi-inexistente-xyz&limit=10');
console.log('Todos os cenários responderam abaixo de 300ms (0,3s).');

