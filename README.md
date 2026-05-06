# House of Cards

Play-money online Texas Hold'em for up to 6 players per room.

## What is implemented

- Email-based dev sign-in with a one-time 1,000,000 chip account grant.
- Room creation, room-code join, quick join, ready flow, and max 6 seats.
- Authoritative Socket.IO server for deck shuffle, turns, blinds, legal actions, pots, showdown, and settlement.
- Private hole-card snapshots per socket; public state only exposes whether other seats have cards.
- React UI with lobby, table controls, chip/bet displays, private hand, and SFX volume/mute.
- React Three Fiber table scene with cards, chips, and a stylized croupier whose eyes/head follow the local cursor within a front-facing clamp.
- Prisma Postgres schema for durable users, balances, rooms, hands, actions, and settlements.
- Redis-ready presence store, with in-memory fallback for local development.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

Without `DATABASE_URL` and `REDIS_URL`, the app runs with in-memory users and presence. For durable balances and hand history, copy `.env.example` to `.env`, configure Postgres and Redis, then run:

```bash
npm run db:generate
npm run db:migrate
npm run dev
```

## Scripts

- `npm run dev` starts the Socket.IO server on `127.0.0.1:8787` and Vite on `127.0.0.1:5173`.
- `npm run build` type-checks and builds the client.
- `npm run test` runs poker engine tests.
- `npm run lint` runs TypeScript checks.

## Architecture

The poker engine owns game state. The client renders snapshots and submits requested actions only. Cards, pots, turn order, action legality, winners, and settlements are all calculated server-side.

Postgres is the durable source for accounts and settlement history. Redis is for ephemeral multiplayer presence and future horizontal scaling. The local in-memory fallback exists only to make development easy before infrastructure is provisioned.
