# Hero Factory — Sistema de Heróis e Missões

Sistema fullstack de gerenciamento de heróis, missões, histórico de alterações, upload de avatares e importação em massa de CSV, projetado para operar com **consistência sob concorrência real** em múltiplas instâncias da API compartilhando **MySQL 8.4** atrás de um **endereço único (Nginx)**.

---

## Visão Geral & Stack Tecnológica

| Camada | Tecnologias | Papel na Arquitetura |
|---|---|---|
| **Backend (`api/`)** | Node.js 22, NestJS 11 (`@nestjs/platform-express`), Express, TypeScript 7 (`^7.0.2`), Busboy, Zod 4, `class-validator` | Monólito Modular com Bounded Contexts, DI, validação na borda e tipagem estrita |
| **Banco de Dados** | MySQL 8.4 (`mysql2/promise`), SQL Migrations, `utf8mb4_0900_ai_ci` | Persistência, índices compostos de cobertura, locks pessimistas/otimistas e lock distribuído |
| **Frontend (`web/`)** | React 19, Vite 6, TypeScript 5.8 (`tsc -b`), CSS puro modular | SPA feature-based, reconciliação otimista de conflitos e paginação por cursor |
| **Gateway / Proxy** | Nginx (Docker) / Vite Dev Proxy | Ponto de entrada único (`:8088`), balanceamento round-robin entre `api1` e `api2`, limite de payload (15 MB) |
| **Qualidade & Testes** | Vitest 5, `light-my-request`, `tsx` | 299 testes automatizados (unitários + integração multi-instância) + benchmark p95 `< 300 ms` |

---

## 1. Setup Rápido (Zero Dor de Cabeça)

### Pré-requisitos
- **Docker + Docker Compose** (único requisito para subir a stack completa em containers)
- **Node.js 22+** (para desenvolvimento local, pois os scripts usam `--env-file-if-exists` nativo do Node)

### Opção A — Desenvolvimento Local em 1 Comando

Na raiz do repositório:

```bash
npm run setup
```

O script [scripts/setup.mjs](scripts/setup.mjs) executa automaticamente 6 etapas idempotentes:
1. Verifica Docker e Docker Compose no ambiente.
2. Cria `api/.env` a partir de [api/.env.example](api/.env.example) (sem sobrescrever caso já exista).
3. Sobe o container `mysql` (MySQL 8.4 na porta `3307` do host) e aguarda o status `healthy`.
4. Instala dependências de `api/` e `web/`.
5. Aplica as migrações SQL ([api/migrations/001_initial.sql](api/migrations/001_initial.sql)).
6. Executa o **seed idempotente** ([api/src/db/seed.ts](api/src/db/seed.ts) + [api/src/db/seed-dev.ts](api/src/db/seed-dev.ts)) com **100.000 heróis** para benchmark mais os dados *showcase* (heróis conhecidos com avatares PNG, histórico, missões em todos os status e importações CSV).

Em seguida, inicie API + Web com hot-reload:

```bash
# Pela raiz (sobe API + Web juntos):
npm run dev

# Ou em terminais separados:
npm run dev:api   # http://127.0.0.1:3000 (ou PORT definido em api/.env)
npm run dev:web   # http://localhost:5173 (proxy /api -> 127.0.0.1:<PORT>)
```

#### Comandos úteis de manutenção
- **Seed leve apenas com os dados showcase** (sem gerar os 100k heróis de benchmark):
  ```bash
  npm run seed:dev
  ```
- **Limpeza completa do repositório** (derruba containers/volumes Docker e remove `dist/`, `*.tsbuildinfo`, `node_modules/` e `api/.env`, preservando `.env.example`):
  ```bash
  npm run clean
  ```

### Opção B — Stack Completa Multi-Instância em Docker

Para rodar o ambiente exatamente como em produção (Nginx balanceando `api1` + `api2` + MySQL 8.4 + Web estático) sem depender de Node local:

```bash
docker compose up -d --build
# ou via script da raiz:
npm run docker:up
```

O Compose orquestra automaticamente em ordem:
1. **`mysql` (MySQL 8.4)**: cria os bancos `hero_factory` (principal) e `hero_factory_test` (isolado para testes) com collation `utf8mb4_0900_ai_ci`.
2. **`migrate`**: aplica migrações protegidas por lock distribuído (`GET_LOCK`) e executa o seed idempotente.
3. **`api1` e `api2`**: duas réplicas independentes da API Node.js + NestJS 11 ligadas ao mesmo MySQL.
4. **`web` (Nginx + React)**: serve os estáticos e balanceia chamadas HTTP entre `api1` e `api2` em **um único endereço**.

- **Endereço único**: `http://localhost:8088` (ou `APP_PORT=8080 docker compose up -d`).
- Toda resposta da API expõe `X-Instance-Id: api1 | api2` e o Nginx adiciona `X-Upstream-Addr`, permitindo auditar o balanceamento round-robin.

---

## 2. Arquitetura do Projeto

O sistema segue **Monólito Modular** com **Clean Architecture pragmática**, **Bounded Contexts** desacoplados e **Zero SQL `JOIN` entre domínios**, preparado para escala horizontal de instâncias stateless da API.

### 2.1 Topologia em Execução Multi-Instância

```text
                       ┌────────────────────────────┐
                       │    Browser / Cliente       │
                       └─────────────┬──────────────┘
                                     │ HTTP :8088
                                     ▼
                       ┌────────────────────────────┐
                       │   Nginx Reverse Proxy      │
                       │  - Estáticos React (/)     │
                       │  - Upstream round-robin    │
                       │  - Limite payload 15 MB    │
                       └──────┬──────────────┬──────┘
                              │              │
                ┌─────────────▼──┐        ┌──▼─────────────┐
                │  api1 (:3000)  │        │  api2 (:3000)  │
                │ NestJS+Express │        │ NestJS+Express │
                │ X-Instance-Id  │        │ X-Instance-Id  │
                └───────┬────────┘        └────────┬───────┘
                        │                          │
                        └────────────┬─────────────┘
                                     ▼ (pool READ COMMITTED)
                       ┌────────────────────────────┐
                       │      MySQL 8.4 (:3306)     │
                       │  - hero_factory (dev/prod) │
                       │  - hero_factory_test (QA)  │
                       └────────────────────────────┘
```

### 2.2 Backend (`api/src/`) — Monólito Modular & Clean Architecture

O código é dividido estritamente entre **`core/`** (infraestrutura transversal agnóstica de negócio) e **`features/`** (contextos delimitados por domínio):

```text
api/src/
├── app-bootstrap.ts            # Bootstrap NestJS/Express, parser JSON/texto 15 MB, ValidationPipe e HttpExceptionFilter
├── app.module.ts               # Composição raiz e RequestLoggerMiddleware global
├── main.ts                     # Validação de env (Zod), pool MySQL e binding HOST:PORT
├── core/
│   ├── database/               # DatabaseModule, MysqlDatabaseService (selectRows/Zod) e MysqlTransactionManager (Tx opaco via WeakMap)
│   ├── errors/                 # DomainError e códigos semânticos (VALIDATION_ERROR, HERO_VERSION_CONFLICT, etc.)
│   ├── observability/          # AsyncLocalStorage (request-context), RequestLoggerMiddleware e HttpExceptionFilter
│   ├── pagination/             # Keyset cursor encoding/decoding determinístico
│   └── security/               # ValidationPipe factory, streaming Busboy com limite de bytes e sanitização de logs
├── db/                         # Runner de migrations (GET_LOCK) e seeds idempotentes (100k + showcase)
└── features/
    ├── health/                 # Healthcheck (/health, /api/health)
    ├── heroes/                 # Heróis + histórico de auditoria (domain, application, infrastructure, presentation, index.ts)
    ├── missions/               # Missões + escalação e validação de conflito de agenda
    ├── imports/                # Importação assíncrona de CSV em chunks com relatório por linha
    └── avatars/                # Upload/leitura binária em MySQL com checagem de magic bytes
```

#### Fronteiras arquiteturais aplicadas no código
1. **Unit of Work opaco sem vazamento de infra**: [MysqlTransactionManager](api/src/core/database/mysql-transaction.manager.ts#L5-L20) expõe apenas um token opaco `Tx` (via `unique symbol`) associado internamente à `PoolConnection` em um `WeakMap`. Casos de uso em `application/` coordenam transações entre múltiplos repositórios sem conhecer `mysql2`.
2. **Contratos públicos via Barrel (`index.ts`)**: toda comunicação entre features passa exclusivamente pelo `index.ts` do módulo alvo (por exemplo, `imports` consome `isValidAvatarUrl` via [heroes/index.ts](api/src/features/heroes/index.ts#L60), e `missions` consulta heróis apenas pela fachada [HeroFacadeService](api/src/features/heroes/index.ts#L4)).
3. **Zero `JOIN` entre bounded contexts**: cada feature gerencia apenas suas próprias tabelas; consistência referencial em leitura/escrita entre domínios passa por portas e fachadas de aplicação.
4. **Validação dupla de fronteira**: entrada HTTP validada por DTOs (`class-validator` + `ValidationPipe` com `whitelist` e `forbidNonWhitelisted`), e toda leitura SQL validada em runtime por schemas `zod` via `selectRows()`.

### 2.3 Frontend (`web/src/`) — Arquitetura Feature-Based

```text
web/src/
├── App.tsx                     # Orquestração da listagem, navegação por cursor e abas (Heróis / Missões / Importações)
├── components/
│   ├── layout/                 # Header e abas de navegação
│   └── ui/                     # Modal, feedback banners, paginação e estados vazios reutilizáveis
├── lib/                        # Cliente HTTP padronizado, AsyncState (discriminated unions + assertUnreachable) e cursor trail
└── features/
    ├── heroes/                 # CRUD, upload de avatar, merge otimista em conflito de versão, histórico e detalhes
    ├── missions/               # Ciclo de vida da missão (scheduled -> in_progress -> finished/cancelled) e escalação
    └── imports/                # Envio de CSV e polling de progresso/erros por linha
```

- **Estados explícitos sem `any`**: estados assíncronos usam *Discriminated Unions* (`status: 'loading' | 'error' | 'success'`) com checagem exaustiva em tempo de compilação (`never`).
- **Encapsulamento por barris**: interações entre features no frontend (como a aba de missões dentro dos detalhes do herói) consomem somente os exports públicos em `features/<nome>/index.ts`.

### 2.4 Decisões Técnicas & Trade-offs

| Decisão | Contexto / Problema | Escolha Adotada | Alternativa Descartada e Motivo |
|---|---|---|---|
| **Keyset Pagination + Deferred Join** | `OFFSET` degrada linearmente para `O(N)` em 100k linhas e duplica/pula itens se houver registros no mesmo milissegundo | Cursor composto `(created_at DESC, id DESC)` sobre o índice de cobertura `idx_heroes_list` em [001_initial.sql](api/migrations/001_initial.sql) | `LIMIT/OFFSET` tradicional (lento em páginas profundas e instável sob escritas concorrentes) |
| **Locks sob `READ COMMITTED`** | Duas instâncias (`api1`/`api2`) escalando o mesmo herói ou editando no mesmo instante não podem confiar em lock em memória | `SELECT ... FOR UPDATE` na linha do herói serializando verificação de choque de horário; `version` para lock otimista; `GET_LOCK('hero_factory_migrations', 60)` nas migrações | Lock distribuído em Redis (adicionaria infraestrutura extra quando o InnoDB já garante atomicidade transacional na mesma fonte da verdade) |
| **Compilação direta com `tsc` em TS 7** | O pacote `api` usa `typescript@^7.0.2`, cujo executável nativo ainda não expõe a API programática (`ts.createProgram`) exigida pelo `nest build`/`nest start` | `build` via `tsc -p tsconfig.build.json` e hot-reload via [api/scripts/dev.mjs](api/scripts/dev.mjs) (`tsc --watch` + `node --watch`) preservando `emitDecoratorMetadata` | `tsx` em runtime para a API Nest (não emite metadados de decorator para `ValidationPipe`/DI) ou downgrade forçado do TypeScript |
| **Express + Busboy em streaming** | Upload de avatares e CSVs grandes precisam respeitar teto estrito antes de alocar buffers gigantes | Limite explícito de 2 MB por avatar no Busboy + validação por *magic bytes* (PNG/JPEG/WEBP/GIF) + header `X-Content-Type-Options: nosniff`; JSON/text limitados a 15 MB | Aceitar `Content-Type` declarado pelo cliente ou SVG arbitrário (risco de spoofing/XSS) |
| **Host binding explícito** | No Windows (RFC 6724), `localhost` resolve para `::1` antes de `127.0.0.1`, podendo colidir com serviços IPv6 na mesma porta | [main.ts](api/src/main.ts#L6-L27) valida `HOST` (padrão `127.0.0.1` local; `0.0.0.0` em container) e [vite.config.ts](web/vite.config.ts#L7-L17) encaminha `/api` para `127.0.0.1:<PORT>` | `0.0.0.0` fixo em dev local sem configuração de `HOST` |

---

## 3. Regras de Negócio e Contratos da API

### Validação de Campos do Herói

Strings contendo apenas espaços são rejeitadas após `trim()`. Caracteres de controle ASCII (`\0`, etc.) são bloqueados.

| Campo | Obrigatório | Limite | Regras Adicionais |
|---|---:|---:|---|
| `name` | Sim | 120 | Não vazio |
| `nickname` | Sim | 60 | Não vazio |
| `date_of_birth` | Sim | 10 (`AAAA-MM-DD`) | Dia de calendário válido (`DATE` sem conversão de fuso), `>= 1000-01-01` e não futuro no fuso do cliente (`X-Timezone`) |
| `universe` | Sim | 60 | Não vazio |
| `main_power` | Sim | 60 | Não vazio |
| `avatar_url` | Não | 2048 | URL `http(s)://` válida ou `/api/avatars/:id` |
| `id`, `created_at`, `updated_at`, `version` | Servidor | — | Controlados exclusivamente pelo servidor |

### Garantia de Consistência em Concorrência

- **Unicidade lógica (`uq_heroes_identity`)**: combina `(name, nickname, date_of_birth, alive)` com collation `utf8mb4_0900_ai_ci` (insensível a maiúsculas e acentos). `alive` é coluna gerada (`1` se `deleted_at IS NULL`, `NULL` se excluído), impedindo duplicatas ativas e liberando novo cadastro após exclusão lógica.
- **Criação Idempotente (`Idempotency-Key`)**: a UI gera um UUID único ao abrir o formulário de criação. Retentativas ou cliques duplos encontram a chave em `uq_heroes_idempotency_key`, conferem o hash SHA-256 do payload e devolvem o mesmo herói (`200 OK`) sem duplicar linhas.
- **Edição Concorrente (Lock Otimista + Merge na UI)**: edições simultâneas enviam `version`. Se outra instância já tiver incrementado a versão sob `SELECT ... FOR UPDATE`, a API retorna `409 HERO_VERSION_CONFLICT` com `details.current_hero`, e a tela permite mesclar automaticamente os campos editados pelo usuário sobre a versão mais nova.
- **Choque de Horário em Missões**: dois intervalos $[A_{\text{início}}, A_{\text{fim}})$ e $[B_{\text{início}}, B_{\text{fim}})$ conflitam apenas se $A_{\text{início}} < B_{\text{fim}} \land A_{\text{fim}} > B_{\text{início}}$ (logo `10h–12h` e `12h–14h` não colidem), considerando missões `scheduled` e `in_progress`. Transações sob `READ COMMITTED` adquirem lock exclusivo na linha do herói antes de validar a agenda, bloqueando a segunda instância com `409 MISSION_SCHEDULE_CONFLICT`.

### Rotas da API e Envelope Único de Erro

Todas as rotas respondem tanto na raiz (`/heroes`) quanto sob o prefixo `/api` (`/api/heroes`) por meio de decorators `@Controller(['recurso', 'api/recurso'])`:

| Método e Rota | Descrição |
|---|---|
| `GET /health` | Status da instância (`X-Instance-Id`) e conectividade com MySQL |
| `GET /heroes` | Listagem paginada por cursor (`search`, `cursor`, `limit`) |
| `GET /heroes/:id` | Detalhes do herói |
| `POST /heroes` | Criação de herói (`Idempotency-Key`, `X-Timezone`) |
| `PATCH /heroes/:id` | Edição de herói ativo (exige `version`) |
| `POST /heroes/:id/activate` \| `/deactivate` | Ativa/inativa herói e grava trilha em `hero_history` |
| `DELETE /heroes/:id` | Soft delete (`deleted_at`), preservando histórico em missões |
| `GET /heroes/:id/history` | Histórico paginado de alterações (`field`, `cursor`, `limit`) |
| `GET /heroes/:id/missions` | Missões em que o herói participou (`status`, `cursor`, `limit`) |
| `GET /missions` \| `GET /missions/:id` \| `POST /missions` | Consulta e criação de missões (`scheduled`) |
| `POST /missions/:id/heroes` \| `DELETE /missions/:id/heroes/:heroId` | Escalação/desescalação atômica de herói ativo |
| `POST /missions/:id/start` \| `/finish` \| `/cancel` | Transições de máquina de estado da missão |
| `POST /imports/heroes` \| `GET /imports/heroes` \| `GET /imports/heroes/:id` | Importação CSV em segundo plano (até 20 mil linhas) e relatório por linha |
| `POST /avatars` \| `GET /avatars/:id` | Upload `multipart/form-data` (máx. 2 MB) e cache `immutable` |

Qualquer erro retorna o contrato único abaixo (`400`, `404`, `409`, `413` ou `500`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Alguns campos estão inválidos.",
    "fields": [
      { "field": "date_of_birth", "message": "A data de nascimento não pode ser no futuro." }
    ],
    "details": {}
  }
}
```

---

## 4. Testes Automatizados, Circuit Breaker & Benchmark (< 0,3 s)

### 4.1 Executando os Testes e Typecheck

```bash
# Validação de tipagem estrita em api/ e web/
npm run typecheck

# Suíte completa pela raiz (274 testes na API em 41 arquivos + 25 testes no Web em 4 arquivos = 299 testes)
npm test

# Ou rodar apenas os testes isolados dentro do Docker (sem precisar de Node local):
npm run docker:test
# equivalente a: docker compose --profile test run --rm tests
```

> **Circuit Breaker de Testes** ([api/test/circuit-breaker.ts](api/test/circuit-breaker.ts)): a suíte de integração recusa execução caso `NODE_ENV=production`, caso `DATABASE_URL_TEST` esteja ausente ou caso aponte para o mesmo banco de `DATABASE_URL` (`hero_factory`), protegendo integralmente os 100 mil registros do banco principal. *(Evite rodar `npm test` local e `docker compose --profile test` simultaneamente, pois ambos compartilham o schema `hero_factory_test`.)*

### 4.2 Medição de Latência com 100.000 Heróis (`p95 < 300 ms`)

Com a stack Docker no ar (`docker compose up -d --build`), execute:

```bash
npm run bench
# ou: cd api && npm run bench
```

O script [api/src/scripts/bench.ts](api/src/scripts/bench.ts) executa **20 rodadas sequenciais** (após warm-up) contra `http://localhost:8088` com **100.000 heróis** e falha automaticamente se o `p95` de qualquer cenário atingir `300 ms`:

| Cenário | `min` | `avg` | `p95` | `max` | Instâncias atendidas | Meta |
|---|---:|---:|---:|---:|---|---|
| 1. Primeira página (`GET /api/heroes?limit=10`) | 2,4 ms | 10,4 ms | 134,8 ms | 134,8 ms | `api1`, `api2` | `< 300 ms` |
| 2. Busca por nome sem acento (`?search=joao`) | 2,4 ms | 5,4 ms | 35,1 ms | 35,1 ms | `api2`, `api1` | `< 300 ms` |
| 3. Busca por apelido (`?search=relampago`) | 2,5 ms | 6,3 ms | 28,1 ms | 28,1 ms | `api1`, `api2` | `< 300 ms` |
| 4. Busca rara em 100k (`?search=Relampago%201`) | 27,0 ms | 30,2 ms | 44,3 ms | 44,3 ms | `api2`, `api1` | `< 300 ms` |
| 5. Busca sem resultado (varredura em 100k) | 29,5 ms | 31,1 ms | 36,4 ms | 36,4 ms | `api1`, `api2` | `< 300 ms` |
