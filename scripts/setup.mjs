#!/usr/bin/env node

/**
 * Script de Setup Automatizado do Hero Factory
 * Compatível com Windows (PowerShell/CMD), Linux e macOS.
 */

import { copyFileSync, existsSync } from 'node:fs';
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
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(title, message = '') {
  console.log(`${colors.cyan}[SETUP]${colors.reset} ${colors.bright}${title}${colors.reset} ${message}`);
}

function success(message) {
  console.log(`${colors.green}✔ ${message}${colors.reset}`);
}

function warn(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

function error(message) {
  console.error(`${colors.red}✖ ${message}${colors.reset}`);
}

function run(command, cwd = ROOT_DIR, customErrorMessage = '') {
  try {
    execSync(command, { cwd, stdio: 'inherit' });
  } catch (err) {
    if (customErrorMessage) {
      error(customErrorMessage);
    }
    throw err;
  }
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function main() {
  console.log(`\n${colors.bright}${colors.blue}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}  HERO FACTORY — SETUP COMPLETO DO REPOSITÓRIO      ${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}====================================================${colors.reset}\n`);

  // 1. Verificação de Pré-requisitos
  log('1/6', 'Verificando ambiente (Docker e Docker Compose)...');
  try {
    execSync('docker -v', { stdio: 'pipe' });
    execSync('docker compose version', { stdio: 'pipe' });
    success('Docker e Docker Compose detectados.');
  } catch {
    error('Docker ou Docker Compose não estão instalados ou não foram encontrados no PATH.');
    process.exit(1);
  }

  // 2. Configuração dos arquivos .env
  log('2/6', 'Configurando arquivos de variáveis de ambiente (.env)...');
  const envFiles = [
    { src: resolve(ROOT_DIR, 'api/.env.example'), dest: resolve(ROOT_DIR, 'api/.env'), name: 'api' },
  ];

  for (const { src, dest, name } of envFiles) {
    if (!existsSync(src)) {
      warn(`Arquivo template ${src} não encontrado.`);
      continue;
    }
    if (existsSync(dest)) {
      log(`  - ${name}: .env já existe (mantido sem sobrescrever).`);
    } else {
      copyFileSync(src, dest);
      success(`  - ${name}: .env criado a partir de .env.example.`);
    }
  }

  // 3. Subir o MySQL 8.4 via Docker Compose
  log('3/6', 'Inicializando banco de dados MySQL 8.4 via Docker Compose...');
  try {
    run('docker compose up -d mysql', ROOT_DIR);
    success('Container do MySQL provisionado.');
  } catch {
    error('Falha ao iniciar o container Docker. Verifique se o daemon do Docker Desktop está rodando.');
    process.exit(1);
  }

  // Aguardar o Healthcheck do MySQL ficar "healthy" (inclui inicialização do volume novo)
  log('3/6', 'Aguardando o MySQL responder ao healthcheck...');
  let isHealthy = false;
  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const output = execSync('docker compose ps mysql --format json', {
        cwd: ROOT_DIR,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });

      if (output.includes('"healthy"') || output.includes('(healthy)')) {
        isHealthy = true;
        break;
      }
    } catch {
      // Ignora erro temporário enquanto o container ainda inicializa
    }
    await sleep(2000);
  }

  if (isHealthy) {
    success('MySQL está saudável e pronto para conexões.');
  } else {
    warn('MySQL ainda está inicializando. Prosseguindo com cuidado...');
  }

  // 4. Instalar Dependências Isoladas (Backend & Frontend)
  log('4/6', 'Instalando dependências isoladas...');

  console.log(`\n${colors.cyan}--- Instalando dependências de api ---${colors.reset}`);
  run('npm install', resolve(ROOT_DIR, 'api'), 'Falha ao instalar dependências em api.');
  success('Dependências de api instaladas.');

  console.log(`\n${colors.cyan}--- Instalando dependências de web ---${colors.reset}`);
  run('npm install', resolve(ROOT_DIR, 'web'), 'Falha ao instalar dependências em web.');
  success('Dependências de web instaladas.');

  // 5. Aplicar Migrações SQL
  log('5/6', 'Aplicando migrações SQL no MySQL...');
  run('npm run migrate', resolve(ROOT_DIR, 'api'), 'Falha ao aplicar migrações em api.');
  success('Migrações aplicadas com sucesso.');

  // 6. Popular Seed Idempotente (100k heróis + dados iniciais de desenvolvimento)
  log('6/6', 'Executando seed idempotente (100.000 heróis + dados showcase)...');
  run('npm run seed', resolve(ROOT_DIR, 'api'), 'Falha ao executar seed em api.');
  success('Seed concluído com sucesso.');

  // Conclusão
  console.log(`\n${colors.bright}${colors.green}====================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.green}  ✔ SETUP CONCLUÍDO COM SUCESSO!                    ${colors.reset}`);
  console.log(`${colors.bright}${colors.green}====================================================${colors.reset}\n`);

  console.log(`${colors.bright}Modo Desenvolvimento Local (terminais separados):${colors.reset}\n`);
  console.log(`  ${colors.cyan}Terminal 1 (Backend API):${colors.reset}`);
  console.log(`    cd api`);
  console.log(`    npm run dev\n`);
  console.log(`  ${colors.cyan}Terminal 2 (Frontend Web):${colors.reset}`);
  console.log(`    cd web`);
  console.log(`    npm run dev\n`);
  console.log(`  ${colors.magenta}URLs locais:${colors.reset}`);
  console.log(`    - Frontend Web (Vite): ${colors.bright}http://localhost:5173${colors.reset}`);
  console.log(`    - API Healthcheck:     ${colors.bright}http://localhost:3000/health${colors.reset}\n`);
  console.log(`${colors.bright}Ou para subir a stack completa multi-instância (Nginx + api1 + api2):${colors.reset}`);
  console.log(`    ${colors.cyan}npm run docker:up${colors.reset}  ->  ${colors.bright}http://localhost:8088${colors.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${colors.red}Erro fatal durante o setup:${colors.reset}`, err.message);
  process.exit(1);
});

