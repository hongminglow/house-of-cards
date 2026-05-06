# House of Cards

House of Cards is a play-money online Texas Hold'em game for private rooms of up to 6 players. Players sign in with email, enter from the lobby or a room code, sit with a fixed table buy-in, and play continuous hands against an authoritative realtime server.

The product goal is a casino-style poker room with a polished game HUD, readable poker controls, sound feedback, classic card visuals, and a React Three Fiber table scene centered around randomized GLB croupier models.

## Product Highlights

- Email-based dev sign-in with a one-time 1,000,000 chip account grant.
- Persistent bankroll display using game currency formatting and chip iconography.
- Lobby page with room creation, quick join, direct room-code join, open-room list, player summary, featured table, and career pulse panels.
- Full-screen game page with compact edge HUDs so the 3D table remains the focus.
- No-limit Texas Hold'em flow with opening forced bets, preflop, flop, turn, river, showdown, side pots, split pots, and settlement.
- Private hole cards per socket; other players only expose public card presence.
- Poker rules modal available in the lobby and game room, including hand rankings and regular playing-card samples.
- Game-room history modal with completed hand results, local +/- table result, and winner cards only when the hand reaches showdown.
- SFX for card placement, chip movement, check, fold, all-in, winner, join, leave, and warning events, with speaker/mute icon controls.
- Randomized croupier GLB assets loaded from `public/assets/croupiers`.
- Croupier cursor tracking within a front-facing clamp, with a stronger custom response profile for `croupier-serena.glb`.
- Wider dealer table cutout so croupier models sit behind the table with better clearance.
- Loading overlay before the game table becomes interactive.
- Polished interactive button states: pointer cursor, hover lift, active press, focus ring, and disabled styling.

## Game Flow

1. A player signs in with email and a table name.
2. New accounts receive a one-time 1,000,000 chip balance.
3. From the lobby, the player can create a room, quick join, or enter a room code.
4. Sitting at a table deducts the fixed 100,000 buy-in from the account balance and places it into the table stack.
5. The player presses `Ready` once after entering the room. After that, they are considered in the game until they leave, disconnect, run out of table stack, or time out.
6. A hand starts when at least 2 connected seated players are in the game.
7. The server posts the opening forced bets, shuffles and deals hole cards, chooses turn order, and sends each player a private snapshot.
8. On each turn, the player can fold, check, call, bet, raise, or go all-in depending on the server-validated legal action set. The countdown timer only runs in the local action panel when it is that player's turn.
9. Each turn has a timer. If the player does not act before timeout, the server folds them, marks them out of the game, and releases their seat after the hand settles.
10. The hand progresses through preflop, flop, turn, river, and showdown, or ends early when only one contender remains.
11. Settlement is calculated server-side, table stacks update immediately, hand history is saved, and the winner reveal plays.
12. After the reveal delay, the room automatically starts the next hand if at least 2 connected players are still in the game. No repeated ready click is required.
13. Leaving the room returns the current table stack to the account balance when safe. If leaving during an active hand, the seat is cleaned up after the hand flow resolves.

## Architecture

The poker engine owns game state. The client renders snapshots and submits requested actions only. Cards, pots, turn order, action legality, timers, winners, and settlements are all calculated server-side.

- Frontend: React, Vite, Socket.IO client, React Three Fiber, Drei, Three.js.
- Backend: Node, Express, Socket.IO, authoritative poker engine.
- Database: Prisma schema for Postgres-backed users, balances, rooms, hands, actions, and settlements.
- Presence: Redis-ready room presence with in-memory fallback for local development.
- Tests: Vitest coverage for evaluator behavior, private card visibility, action validation, settlement, continuous hand flow, and timeout seat release.

## Local Development

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

## Current Scope

House of Cards is play-money only. There are no purchases, withdrawals, real-money wagering, or gambling compliance flows in this version.
