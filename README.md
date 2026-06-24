# Alphamen Barbearia Backend

API Node.js/Express com Prisma e PostgreSQL.

- Branch oficial de trabalho e desenvolvimento: `dev`
- A branch `main` permanece vazia por enquanto.

## Requisitos

- Node.js 20+
- npm
- PostgreSQL

## Instalação

```bash
npm install
```

## Configuração de ambiente

1. Copie `.env.example` para `.env`.
2. Preencha as variáveis obrigatórias do ambiente local.
3. Não versione o arquivo `.env`.

```bash
cp .env.example .env
```

Campos mínimos:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `CLIENT_URL`
- `ALLOWED_ORIGINS` quando precisar liberar mais de uma origem local
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

Observações:

- Este backend usa secrets separados para access token e refresh token. Não existe uma única variável `JWT_SECRET` no código atual.
- Se você for popular dados locais com seed, use apenas variáveis de desenvolvimento como `DEV_DEFAULT_PASSWORD`, `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`.
- Nunca escreva senhas reais no `.env.example`, no README ou em commits.

## Prisma

Gerar client:

```bash
npm run prisma:generate
```

Rodar migrations em desenvolvimento:

```bash
npx prisma migrate deploy
```

## Seed

```bash
npm run prisma:seed
```

Notas sobre seed local:

- O seed é opcional e usa apenas variáveis do `.env`.
- O usuário admin local deve ser configurado por variáveis de ambiente, sem senha fixa versionada.

## Desenvolvimento

```bash
npm run dev
```

API local padrão:

- `http://localhost:3333/api`
- Healthcheck: `http://localhost:3333/api/health`
- Readiness: `http://localhost:3333/api/ready`

Frontend esperado em desenvolvimento:

- Admin/professional e Portal do Cliente consomem esta mesma API.
- O frontend local padrão roda em `http://localhost:5173`.
- Garanta que `CLIENT_URL` e `ALLOWED_ORIGINS` cubram a origem usada no navegador.

## Testes

```bash
npm test
```
