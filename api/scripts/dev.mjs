#!/usr/bin/env node

/**
 * Inicia a API NestJS em modo watch preservando emitDecoratorMetadata via tsc + node --watch.
 * (tsx/esbuild não emite metadados de decorator necessários para ValidationPipe/DTOs.)
 */

import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tscEntry = resolve(apiDir, 'node_modules/typescript/bin/tsc');

const initialBuild = spawnSync(
  process.execPath,
  [tscEntry, '-p', 'tsconfig.build.json'],
  { cwd: apiDir, stdio: 'inherit' },
);

if (initialBuild.status !== 0) {
  process.exit(initialBuild.status ?? 1);
}

const tscWatch = spawn(
  process.execPath,
  [tscEntry, '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'],
  { cwd: apiDir, stdio: 'inherit' },
);

const nodeWatch = spawn(
  process.execPath,
  ['--watch', '--env-file-if-exists=.env', 'dist/main.js'],
  { cwd: apiDir, stdio: 'inherit' },
);

let exiting = false;
function shutdown(code = 0) {
  if (exiting) return;
  exiting = true;
  tscWatch.kill('SIGTERM');
  nodeWatch.kill('SIGTERM');
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
tscWatch.on('exit', (code) => {
  if (!exiting && code && code !== 0) shutdown(code);
});
nodeWatch.on('exit', (code) => {
  if (!exiting) shutdown(code ?? 0);
});

