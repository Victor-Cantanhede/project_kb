#!/usr/bin/env node

/**
 * Script de Teardown / Limpeza Completa do Hero Factory
 * Compatível com Windows, Linux e macOS (Node.js ESM).
 */

import { existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(title, message = '') {
  console.log(`${colors.cyan}[CLEAN]${colors.reset} ${colors.bright}${title}${colors.reset} ${message}`);
}

function success(message) {
  console.log(`${colors.green}✔ ${message}${colors.reset}`);
}

function warn(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

function removePath(relativePath, description) {
  const fullPath = resolve(ROOT_DIR, relativePath);
  if (existsSync(fullPath)) {
    try {
      rmSync(fullPath, { recursive: true, force: true });
      success(`Removido: ${relativePath} (${description})`);
    } catch (err) {
      warn(`Falha ao remover ${relativePath}: ${err.message}`);
    }
  } else {
    log(`  - ${relativePath} já não existe.`);
  }
}

async function main() {
  console.log(`\n${colors.bright}${colors.red}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.red}  HERO FACTORY — TEARDOWN & LIMPEZA COMPLETA        ${colors.reset}`);
  console.log(`${colors.bright}${colors.red}====================================================${colors.reset}\n`);

  // 1. Derrubar Docker Compose completo com volumes e órfãos
  log('1/4', 'Derrubando containers Docker, volumes e redes...');
  try {
    execSync('docker compose --profile test down -v --remove-orphans', {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
    success('Containers, volumes persistentes e redes do Docker foram removidos.');
  } catch (err) {
    warn(`Docker down retornou aviso ou falha: ${err.message}`);
  }

  // 2. Apagar diretórios de build e caches TypeScript/Vite
  log('2/4', 'Removendo pastas de build, compilação e caches...');
  const buildPaths = [
    { path: 'api/dist', desc: 'Build de compilação da API' },
    { path: 'api/tsconfig.tsbuildinfo', desc: 'Cache incremental TypeScript da API' },
    { path: 'web/dist', desc: 'Build de produção do Frontend' },
    { path: 'web/tsconfig.tsbuildinfo', desc: 'Cache incremental TypeScript do Frontend' },
  ];

  for (const item of buildPaths) {
    removePath(item.path, item.desc);
  }

  // 3. Apagar node_modules isolados e da raiz
  log('3/4', 'Removendo diretórios node_modules...');
  const modulePaths = [
    { path: 'api/node_modules', desc: 'Dependências da API NestJS' },
    { path: 'web/node_modules', desc: 'Dependências do Frontend React' },
    { path: 'node_modules', desc: 'Cache/dependências da raiz' },
  ];

  for (const item of modulePaths) {
    removePath(item.path, item.desc);
  }

  // 4. Remover arquivos .env gerados (mantendo .env.example)
  log('4/4', 'Removendo arquivos .env locais...');
  const envPaths = [
    { path: '.env', desc: 'Variáveis de ambiente locais da raiz' },
    { path: 'api/.env', desc: 'Variáveis de ambiente locais da API' },
    { path: 'web/.env', desc: 'Variáveis de ambiente locais do Frontend' },
  ];

  for (const item of envPaths) {
    removePath(item.path, item.desc);
  }

  console.log(`\n${colors.bright}${colors.green}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.green}  ✔ TEARDOWN CONCLUÍDO COM SUCESSO!                 ${colors.reset}`);
  console.log(`${colors.bright}${colors.green}====================================================${colors.reset}\n`);
  console.log(`${colors.bright}O repositório foi restaurado ao estado limpo original.${colors.reset}`);
  console.log(`Para recriar tudo novamente do zero, basta executar: ${colors.cyan}npm run setup${colors.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${colors.red}Erro fatal durante a limpeza:${colors.reset}`, err.message);
  process.exit(1);
});

