# Alphamen Barbearia Backend

API Node.js/Express com Prisma e PostgreSQL.

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
2. Preencha as variáveis obrigatórias, principalmente `DATABASE_URL`, `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET`.
3. Não versione o arquivo `.env`.

```bash
cp .env.example .env
```

## Prisma

Gerar client:

```bash
npm run prisma:generate
```

Rodar migrations em desenvolvimento:

```bash
npm run prisma:migrate
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
