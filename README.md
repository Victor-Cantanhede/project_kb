# Hero Factory — Sistema de Heróis e Missões

Sistema fullstack de gerenciamento de heróis e missões construído para operar corretamente sob concorrência real com **duas instâncias da API** compartilhando **MySQL 8.4** atrás de um **endereço único (Nginx)**.

---

## 1. Setup Rápido e Execução

### Setup automatizado para desenvolvimento local (raiz do repositório)

Para provisionar `api/.env` a partir de `api/.env.example`, subir o MySQL 8.4 via Docker, aguardar o healthcheck, instalar as dependências de `api/` e `web/`, aplicar as migrações SQL e executar o seed idempotente (100.000 heróis para benchmark + dados iniciais de heróis showcase, avatares, histórico de alterações, missões em todos os status e importações CSV) em um único comando:

```bash
npm run setup
```

*(Caso queira rodar apenas os dados iniciais showcase sem a massa de 100k heróis em um banco recém-migrado, execute `npm run seed:dev` na raiz.)*

Depois do `npm run setup`, você pode rodar backend e frontend localmente com hot-reload em terminais separados:

```bash
# Terminal 1 — Backend API (http://localhost:3000)
cd api
npm run dev

# Terminal 2 — Frontend Web (http://localhost:5173 com proxy /api -> localhost:3000)
cd web
npm run dev
```

Para restaurar o repositório ao estado limpo (derrubando containers/volumes Docker e removendo `dist/`, `*.tsbuildinfo`, `node_modules/` e `.env` gerados, preservando `.env.example`):

```bash
npm run clean
```

### Subir a stack completa em Docker (Nginx + `api1` + `api2`)

Em um clone novo do repositório (requer apenas Docker com Docker Compose), ou via `npm run docker:up` na raiz:

```bash
docker compose up -d --build
```

O comando acima executa automaticamente, em ordem:
1. **`mysql` (MySQL 8.4)**: inicializa o banco principal (`hero_factory`) e o banco isolado de testes (`hero_factory_test`) com collation `utf8mb4_0900_ai_ci` (case-insensitive e accent-insensitive nativo).
2. **`migrate`**: aplica as migrações SQL (`api/migrations/001_initial.sql`) protegidas por lock distribuído (`GET_LOCK`) e executa o **seed idempotente de 100.000 heróis** (rodar novamente não duplica nenhum registro).
3. **`api1` e `api2`**: duas instâncias independentes da API Node.js + TypeScript (NestJS 11 + Express) conectadas ao mesmo MySQL.
4. **`web` (Nginx + React)**: serve o frontend estático e faz o balanceamento de carga round-robin das chamadas HTTP entre `api1` e `api2` em **um único endereço**.

### Endereço único

- **Tela e API**: `http://localhost:8088` (ou defina `APP_PORT=8080 docker compose up -d` para usar outra porta).
- A tela conversa apenas com `/api/...` na mesma origem, e o Nginx também encaminha chamadas diretas a `/heroes`, `/missions`, `/imports`, `/avatars` e `/health` para o pool `api1`/`api2`.
- Toda resposta inclui os cabeçalhos `X-Instance-Id: api1 | api2` e `X-Upstream-Addr`, permitindo comprovar a divisão de carga entre as instâncias.

---

## 2. Rodar os testes e o benchmark

### Testes automatizados (Unitários + Integração Multi-Instância)

Pelo Docker (sem precisar de Node instalado na máquina):

```bash
npm run docker:test
# ou diretamente:
docker compose --profile test run --rm tests
```

Ou localmente pela raiz (com o container `mysql` rodando):

```bash
npm test          # roda testes unitários + integração multi-instância da API e testes do Web
npm run typecheck # valida TypeScript em api/ e web/
```

> **Isolamento de banco de testes (Circuit Breaker)**: os testes de integração passam por um *circuit breaker* (`api/test/circuit-breaker.ts`) que bloqueia a execução caso `NODE_ENV=production`, caso `DATABASE_URL_TEST` não esteja definida ou caso seja idêntica a `DATABASE_URL` (`hero_factory`), garantindo que o banco de desenvolvimento com os 100 mil heróis nunca seja alterado pelos testes.

### Medição de velocidade com 100 mil heróis (< 0,3 segundo)

Com a stack no ar (`docker compose up -d`), execute:

```bash
cd api
npm run bench
```

#### Como medimos e resultados obtidos

O script `api/src/scripts/bench.ts` dispara 20 requisições sequenciais (após warm-up) contra o endereço único (`http://localhost:8088`) com **100.000 heróis** no banco e falha caso o `p95` de qualquer cenário atinja `300ms` (`0,3s`):

| Cenário | `min` | `avg` | `p95` | `max` | Instâncias atendidas | Meta |
|---|---:|---:|---:|---:|---|---|
| 1. Primeira página (`GET /api/heroes?limit=10`) | 2,0 ms | 3,5 ms | 10,0 ms | 10,0 ms | `api1`, `api2` | `< 300 ms` |
| 2. Busca por nome sem acento (`?search=joao`) | 2,1 ms | 2,6 ms | 3,6 ms | 3,6 ms | `api1`, `api2` | `< 300 ms` |
| 3. Busca por apelido sem acento (`?search=relampago`) | 1,9 ms | 2,3 ms | 3,8 ms | 3,8 ms | `api1`, `api2` | `< 300 ms` |
| 4. Busca rara em 100k (`?search=Relampago%201`) | 26,1 ms | 27,6 ms | 29,6 ms | 29,6 ms | `api1`, `api2` | `< 300 ms` |
| 5. Busca sem resultado (varredura total em 100k) | 29,7 ms | 30,5 ms | 34,1 ms | 34,1 ms | `api1`, `api2` | `< 300 ms` |

**Por que é rápido**:
- A tabela `heroes` possui o índice composto de cobertura `idx_heroes_list (deleted_at, created_at DESC, id DESC, name, nickname)` com collation `utf8mb4_0900_ai_ci` (insensível a maiúsculas e acentos), consultado via *deferred join*.
- A paginação usa **keyset cursor** (`(created_at, id)` em ordem decrescente), evitando `OFFSET` lento em páginas profundas e garantindo que heróis criados no mesmo milissegundo nunca se repitam nem sumam entre páginas.

---

## 3. Regras de negócio e definições documentadas

### Tamanho máximo dos campos do Herói

Strings contendo apenas espaços em branco são rejeitadas após `trim()`. Caracteres de controle ASCII (`\0`, etc.) são bloqueados.

| Campo | Obrigatório | Tamanho máximo | Regras adicionais |
|---|---|---:|---|
| `name` | Sim | **120** caracteres | Sem espaços vazios |
| `nickname` | Sim | **60** caracteres | Sem espaços vazios |
| `date_of_birth` | Sim | **10** (`AAAA-MM-DD`) | Dia de calendário válido (`DATE` sem fuso), `>= 1000-01-01` e **não pode ser no futuro** (avaliado no fuso de quem usa via cabeçalho `X-Timezone`) |
| `universe` | Sim | **60** caracteres | Sem espaços vazios |
| `main_power` | Sim | **60** caracteres | Sem espaços vazios |
| `avatar_url` | Não | **2048** caracteres | URL `http(s)://` válida ou caminho de upload `/api/avatars/:id` (até 2 MB, validado por magic bytes PNG/JPEG/WEBP/GIF) |
| `id`, `created_at`, `updated_at` | Servidor | — | Definidos apenas pelo servidor; valores enviados no corpo da requisição são ignorados |

### Quando um herói conta como repetido

Um herói ativo/inativo (não excluído) é identificado de forma única pela combinação:

```text
(name, nickname, date_of_birth) — sem diferenciar maiúsculas nem acentos (utf8mb4_0900_ai_ci)
```

Implementado no banco pela constraint `UNIQUE KEY uq_heroes_identity (name, nickname, date_of_birth, alive)`, onde `alive` é uma coluna gerada (`1` enquanto `deleted_at IS NULL`, `NULL` quando excluído). Assim:
- Dois heróis não excluídos não podem ter o mesmo `(name, nickname, date_of_birth)`.
- Reenviar o mesmo arquivo CSV não duplica heróis: linhas já existentes são contabilizadas em `duplicate_count`.
- Se um herói foi excluído (`deleted_at IS NOT NULL`), um novo cadastro com os mesmos dados é permitido sem conflito.

### Criar duas vezes (Idempotência)

Protegido em duas camadas:
1. **`Idempotency-Key` (cabeçalho HTTP)**: ao abrir o modal de criação, a tela gera um UUID único para aquela operação e o envia no cabeçalho `Idempotency-Key`. Se a pessoa clicar duas vezes em **Salvar**, ou se a internet cair após a API criar o herói e a pessoa clicar em **Salvar** novamente, a segunda requisição encontra a chave na constraint `uq_heroes_idempotency_key`, valida o hash SHA-256 do payload e devolve o mesmo herói já criado (`200 OK`), mantendo **um único herói** no banco.
2. **Identidade única (`uq_heroes_identity`)**: mesmo sem o cabeçalho `Idempotency-Key`, chamadas duplicadas concorrentes são barradas pelo índice único do MySQL (`409 DUPLICATE_HERO`).

### Editar ao mesmo tempo (Controle de concorrência otimista + Merge)

1. Cada herói possui um campo inteiro `version` (iniciado em `1` e incrementado a cada alteração).
2. Ao abrir o modal de edição do Hulk (`version: 1`), tanto a Ana quanto o Bruno carregam `version: 1`.
3. A Ana altera `nickname` para `"Hulk Verde"` e envia `PATCH /heroes/:id` com `{ nickname: "Hulk Verde", version: 1 }`. A API faz `SELECT ... FOR UPDATE`, confirma `version === 1`, aplica a mudança e incrementa `version` para `2`.
4. O Bruno altera `universe` e envia `PATCH /heroes/:id` com `version: 1`. A API detecta `patch.version (1) !== current.version (2)` e responde `409 Conflict` (`HERO_VERSION_CONFLICT`) trazendo nos detalhes o estado atualizado do servidor (`current_hero` na versão `2`).
5. Na tela, o Bruno vê o aviso e clica em **"Atualizar dados sem perder o que digitei"**: a tela mescla apenas os campos que o Bruno editou sobre a versão `2` da Ana (`nickname: "Hulk Verde"` + novo `universe` do Bruno) e salva com sucesso na versão `3`.

### Escalação ao mesmo tempo e choque de horário em Missões

1. Dois intervalos $[A_{\text{início}}, A_{\text{fim}})$ e $[B_{\text{início}}, B_{\text{fim}})$ batem se e somente se $A_{\text{início}} < B_{\text{fim}} \land A_{\text{fim}} > B_{\text{início}}$. Portanto, uma missão das `10h` às `12h` e outra das `12h` às `14h` **não** têm choque. Apenas missões `scheduled` e `in_progress` contam para choque de horário.
2. Quando a Ana (na `api1`) e o Bruno (na `api2`) escalam o Thor no mesmo instante em duas missões com horários que batem:
   - Ambas as transações (`READ COMMITTED`) executam primeiro `SELECT ... FROM heroes WHERE id = ? AND deleted_at IS NULL FOR UPDATE` na linha do Thor.
   - O InnoDB serializa as duas transações na linha do herói.
   - A primeira transação verifica que não há choque, insere em `mission_heroes` e faz `COMMIT`.
   - A segunda transação adquire o lock logo em seguida, lê os dados já comitados (`READ COMMITTED`), encontra a missão conflitante recém-inserida e falha com `409 Conflict` (`MISSION_SCHEDULE_CONFLICT`).

---

## 4. Rotas da API e Formato Único de Erro

Todas as rotas estão disponíveis tanto na raiz (`/heroes`) quanto sob `/api` (`/api/heroes`):

| Método e Rota | Descrição |
|---|---|
| `GET /heroes` | Lista e busca paginada (`search`, `cursor`, `limit`) |
| `GET /heroes/:id` | Detalhes de um herói |
| `POST /heroes` | Cria um herói (suporta cabeçalho `Idempotency-Key` e `X-Timezone`) |
| `PATCH /heroes/:id` | Edita um herói ativo (requer `version` para lock otimista) |
| `POST /heroes/:id/activate` | Ativa um herói inativo (registra no histórico) |
| `POST /heroes/:id/deactivate` | Inativa um herói ativo (registra no histórico) |
| `DELETE /heroes/:id` | Exclusão lógica (`deleted_at`); preserva o nome nas missões |
| `GET /heroes/:id/history` | Histórico paginado de mudanças (`field`, `cursor`, `limit`) |
| `GET /heroes/:id/missions` | Missões de que o herói participou (`status`, `cursor`, `limit`) |
| `GET /missions` | Lista missões com filtro por `status` e `hero_id` |
| `GET /missions/:id` | Detalhes de uma missão |
| `POST /missions` | Cria uma missão agendada (`title`, `starts_at`, `ends_at`) |
| `POST /missions/:id/heroes` | Escala um herói ativo na missão agendada (`{ hero_id }`) |
| `DELETE /missions/:id/heroes/:heroId` | Remove um herói da missão agendada |
| `POST /missions/:id/start` | Inicia missão agendada (exige ao menos 1 herói) |
| `POST /missions/:id/finish` | Encerra missão em andamento (`{ result: "succeeded" \| "failed" }`) |
| `POST /missions/:id/cancel` | Cancela missão agendada ou em andamento |
| `POST /imports/heroes` | Inicia importação de CSV em segundo plano (até 20 mil heróis) |
| `GET /imports/heroes` | Lista importações recentes e seu progresso |
| `GET /imports/heroes/:id` | Consulta andamento e erros por linha de uma importação |
| `POST /avatars` | Faz upload de imagem de avatar do computador (`multipart/form-data`) |
| `GET /avatars/:id` | Serve a imagem de avatar armazenada |

### Formato único de erro

Qualquer erro da API responde com o envelope padronizado abaixo e código HTTP correspondente (`400` validação/payload inválido, `404` recurso ou rota inexistente, `409` conflito de estado/versão/horário/duplicidade, `413` arquivo acima do limite, `500` falha inesperada):

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

## 5. Arquitetura (NestJS 11 + React Feature-Based, SOLID & Strict TypeScript)

O backend (`api/src/`) segue **NestJS 11 com Modular Monolith + Clean Architecture Pragmática** (`core/` + `features/`):

```text
api/src/
├── core/
│   ├── database/        # DatabaseModule.forRoot(pool), MysqlDatabaseService e transações READ COMMITTED
│   ├── errors/          # DomainError e mapeamento HTTP
│   ├── observability/   # HttpExceptionFilter, RequestLoggerMiddleware e AsyncLocalStorage
│   ├── pagination/      # Cursor keyset determinístico
│   └── security/        # ValidationPipe global, multipart e sanitização de logs
└── features/
    ├── health/          # Healthcheck (/health, /api/health)
    ├── heroes/          # Bounded Context de Heróis e Histórico (domain, application, infrastructure, presentation, index.ts)
    ├── missions/        # Bounded Context de Missões e Escalação (comunica com heroes via HeroFacadeService)
    ├── imports/         # Bounded Context de Importação CSV em segundo plano
    └── avatars/         # Bounded Context de Upload e leitura de Avatares
```

O frontend (`web/src/`) segue **React Feature-Based** com `lib/` (cliente HTTP, utilitários e cópia de negócio), `components/` (`layout/` e `ui/`) e `features/` (`heroes`, `missions`, `imports`) isolados por domínio.

Na raiz do repositório, [package.json](file:///c:/Users/victo/dev/testes/mid-level-test/package.json) e [scripts/](file:///c:/Users/victo/dev/testes/mid-level-test/scripts) (`setup.mjs` e `clean.mjs`) orquestram o provisionamento e a limpeza completa do ambiente.

- **Zero SQL `JOIN` entre features**: cada feature é dona exclusiva de suas tabelas; `missions` consulta `heroes` exclusivamente pela facade pública `HeroFacadeService` (`api/src/features/heroes/index.ts`).
- **TypeScript estrito**: zero `any`, zero non-null assertions (`!`), validação de borda com DTOs (`class-validator` + `ValidationPipe`) na API e `zod` nas leituras do MySQL, e estados assíncronos no frontend modelados com **Discriminated Unions** (`status: 'loading' | 'error' | 'success'`) verificadas exaustivamente com `never`.
