# Medical Tracker — MVP (local prototype)

A mobile-first medical record tracker: upload lab reports/prescriptions, OCR-extract
parameters, verify them, see longitudinal trends, share a scoped view with a doctor,
link family members, and export a PDF history. This repo is a **local prototype** —
paid third-party services (cloud OCR, LLM, S3, push, SMS) are substituted with free
local equivalents behind interfaces so they can be swapped via config later.

Built phase-by-phase from the Build Playbook. **Current status: Phase 0 (Foundations).**

## Monorepo layout

```
apps/
  api/           NestJS 10 backend (Prisma 5, Postgres)  — port 3000 (ws 3001)
  worker/        BullMQ OCR/normalization worker (Redis)
  doctor-share/  Next.js 14 public share web view        — port 3002
  mobile/        Expo (React Native) client              — Expo Go / emulator
packages/
  shared-types/      canonical TS types + Zod schemas (the contract)
  parameter-catalog/ 80-parameter seed (12 panels) + ranges + fuzzy matcher
  phi-scrubber/      pino logger that redacts PHI everywhere
  eslint-config/     shared lint config
scripts/             db seed + cross-platform dev helpers
```

## Prerequisites

- Node.js 20+ and npm 10+ (developed on Node 22 / npm 11)
- **Docker Desktop** (for Postgres 15 + Redis 7) — required for the DB-backed steps
- For mobile: the **Expo Go** app on a phone, or an Android emulator

## Quickstart

```bash
npm install                 # installs all workspaces; generates the Prisma client
cp .env.example .env        # (already present) adjust if needed

# --- requires Docker Desktop running ---
npm run db:up               # start Postgres + Redis containers
npm run db:migrate          # apply Prisma migrations
npm run db:seed             # seed 80 parameters (+ demo users in development)

npm run dev                 # start api + worker + doctor-share + mobile (parallel)
```

Health check once the API is up:

```bash
curl http://localhost:3000/health    # -> {"status":"ok","db":"up","redis":"up"}
```

### Without Docker

The API still boots without a database and reports `db: "down"` / `redis: "down"`
on `/health` instead of crashing, so you can develop non-DB code. The migrate/seed
steps and a green health check require Docker.

## Useful scripts

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run lint` | ESLint across all workspaces |
| `npm run test` | Vitest (backend/worker/packages) |
| `npm run build` | Build all workspaces via Turborepo |
| `npm run db:reset` | Tear down volumes, re-up, migrate, seed (cross-platform) |
| `npm run phi-scan` | Fail if raw `console.*` is used outside the phi-scrubber |

## Notes for this environment (Windows + Expo Go)

- The dev/db scripts are cross-platform (no bash `sleep`/`&&` assumptions).
- Mobile is tested via **Expo Go on a physical phone**: set `EXPO_PUBLIC_API_URL`
  in `apps/mobile/.env` to your machine's **LAN IP** (see `apps/mobile/.env.example`),
  not `localhost`.
- Heavier mobile native deps (camera, sqlite, secure-store, charts) are installed
  per-phase via `npx expo install` to keep SDK-compatible versions.
