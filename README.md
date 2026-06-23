# Alphamen Barbearia Backend

API Node.js/Express com Prisma e PostgreSQL.

- Branch oficial de desenvolvimento: `dev`
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
2. Preencha as variáveis obrigatórias, principalmente `DATABASE_URL`, `CLIENT_URL`, `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET`.
3. Não versione o arquivo `.env`.

```bash
cp .env.example .env
```

Campos mínimos:

- `DATABASE_URL`
- `CLIENT_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

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

## Desenvolvimento

```bash
npm run dev
```

API local padrão:

- `http://localhost:3333/api`
- Healthcheck: `http://localhost:3333/api/health`
- Readiness: `http://localhost:3333/api/ready`

## Testes

```bash
npm test
```
