# Project Verdant — Supabase Setup Guide

This project uses your existing Supabase project (`seagnmdgauxhqwvmveij.supabase.co`) for authentication, authoritative game data, realtime, and the leaderboard.

## 1. Environment

`.env` (already created, gitignored):

```dotenv
VITE_SUPABASE_URL=https://seagnmdgauxhqwvmveij.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_N2fFvs8IEwxDyK0pysbOcw_Q_r3Yo5Y
```

The publishable key is safe to ship in the browser. Never place a `service_role` key in any `VITE_*` variable.

## 2. Apply the database migrations

The Supabase CLI cannot run on this device (Termux), so apply the SQL files through the **Dashboard → SQL Editor** (or any Postgres client connected to your project). Run them **in order, one file at a time**, each in its own SQL Editor session:

| Order | File | Contents |
|---|---|---|
| 1 | `supabase/migrations/0001_schema.sql` | Tables, constraints, indexes, world_state singleton |
| 2 | `supabase/migrations/0002_account_trigger.sql` | `handle_new_user()` atomic account provisioning |
| 3 | `supabase/migrations/0003_rpc_farm.sql` | Farm RPCs (till/water/plant/harvest), idempotency, mutation rolls |
| 4 | `supabase/migrations/0004_rpc_shop_rooms.sql` | Shop/economy RPCs, matchmaking, weather scheduler, leaderboard view |
| 5 | `supabase/migrations/0005_rls_grants.sql` | RLS policies + minimal grants |
| 6 | `supabase/migrations/0006_realtime_authorization.sql` | Private Realtime channel policies on `realtime.messages` |
| 7 | `supabase/seed.sql` | Crop/tool catalogs and blocked usernames |

Each file is idempotent where practical (`create or replace`, `if not exists`) except `0001`, which expects a fresh schema — on a brand-new project that is fine.

## 3. Auth configuration (required)

In **Dashboard → Authentication → Providers → Email**:

- ✅ Enable Email provider (it is used internally).
- ❌ **Disable "Confirm email"** — accounts use `${username}@game.internal` synthetic addresses that can never receive mail (PRD §3.3).

In **Authentication → URL Configuration**, leave the site URL as-is; no redirects are needed for this game.

## 4. Realtime

Room channels (`room:{room_id}:presence|movement|farm`) are created with `private: true`, and migration `0006` adds RLS policies on `realtime.messages` that verify active room membership.

**Required:** in **Dashboard → Realtime → Settings**, disable **"Allow public access"** so private-channel enforcement is active.

- The client caps Realtime at 20 events/second (`eventsPerSecond: 20`).

## 5. Weather scheduler (cron)

Weather advances in 5-minute epochs via `public.advance_weather_epoch()` (PRD §7.9). Schedule it in **Dashboard → Database → Cron** (or via `pg_cron` in the SQL Editor):

```sql
select cron.schedule(
  'verdant-weather-epoch',
  '*/5 * * * *',
  $$ select public.advance_weather_epoch() $$
);
```

If the scheduler stalls, clients fall back to polling `get_current_weather()` at each epoch boundary, and the game keeps running with the last known weather.

## 6. Verify

1. `npm run dev` → the auth modal appears.
2. Register a username (3–16 letters/numbers) and password (8–72 chars).
3. The account trigger provisions 100 coins, one 8×8 plot (64 tiles), 5 carrot seeds, and 4 level-1 tools.
4. Open a second browser profile, register another account, and confirm both players see each other walking around the plaza.

## 7. Rollback notes

- All tables live in the `public` schema and are drop-cascade safe: `drop schema public cascade; create schema public;` restores a clean state (Supabase-managed objects like `auth` are unaffected).
- The account trigger is attached to `auth.users`; migration files drop it before recreating.
