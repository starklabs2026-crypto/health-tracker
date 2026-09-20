# HealthFolio

A mobile-first personal health record platform. Upload lab reports and prescriptions, extract parameters through the OCR pipeline, track longitudinal trends, share a scoped read-only view with your doctor, and link family members to your health data.

The repository includes local development defaults for PostgreSQL, Redis, storage, OCR, and OTP delivery. Production services are swapped in through environment variables and the mobile app is configured for iOS App Store builds through Expo EAS.

---

## Features

| Feature | Details |
|---|---|
| **Document capture** | Camera, photo library, or PDF upload with progress feedback |
| **OCR pipeline** | pdfjs-dist (PDF text) + Tesseract.js (images) → Fuse.js fuzzy-matched to 80-parameter catalog |
| **80 lab parameters** | 12 clinical panels — CBC, Lipids, Metabolic, Liver, Thyroid, Renal, Bone, Vitamins, Hormones, Cardiac, Inflammatory, Iron |
| **Range engine** | Sex- and age-adjusted reference ranges; Normal / Low / High / Critical flags |
| **Trend view** | Sparkline chart + history list per parameter; manual reading entry |
| **Family sharing** | Invite family members by email/phone; role-based access (Viewer / Contributor / Guardian) |
| **Doctor share** | Time-limited, optionally single-use share links; scoped by date range and parameter set |
| **PDF export** | Full health summary PDF streamed on demand |
| **Real-time updates** | Socket.IO gateway for live OCR progress |
| **Auth** | OTP (email/SMS) + JWT access/refresh rotation + biometric unlock |

---

## Monorepo Layout

```
apps/
  api/            NestJS 11 REST + WebSocket API    -> http://localhost:3000
  worker/         BullMQ OCR worker (Redis queue)
  doctor-share/   Next.js 15 public share web view  -> http://localhost:3002
  mobile/         Expo 55 (React Native) client

packages/
  shared-types/       Zod schemas + TypeScript types (the shared contract)
  parameter-catalog/  80-parameter seed, reference ranges, Fuse.js fuzzy search
  phi-scrubber/       Pino logger that redacts PHI in every log line
  eslint-config/      Shared ESLint config across all workspaces
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | Expo 55 · React Native · Expo Router · TanStack Query · Zustand |
| API | NestJS 11 · Prisma 5 · PostgreSQL 15 · Socket.IO |
| Worker | BullMQ · Redis 7 · Tesseract.js · pdfjs-dist |
| Doctor Share | Next.js 15 (App Router, server components) |
| Shared | TypeScript 5 strict · Zod · Turborepo · npm workspaces |

---

## Prerequisites

- **Node.js 20+** and **npm 10+** (developed on Node 24 / npm 11)
- **Docker Desktop** — required for PostgreSQL 15 and Redis 7
- **Expo Go** for local mobile development, or a simulator/emulator
- **Apple Developer account** and **Expo account** for iOS App Store/TestFlight builds

---

## Getting Started

```bash
# 1. Install all workspace dependencies
npm install

# 2. Copy and configure environment variables
cp .env.example .env

# 3. Start the database and cache (requires Docker Desktop)
npm run db:up

# 4. Apply migrations and seed the parameter catalog
npm run db:migrate
npm run db:seed

# 5. Start everything in parallel
npm run dev
```

Verify the API is healthy:

```bash
curl http://localhost:3000/health
# → {"status":"ok","db":"up","redis":"up"}
```

> **Mobile setup:** Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to your machine's **LAN IP address** (e.g. `http://192.168.1.10:3000`), not `localhost`, when testing on a physical device. A production iOS build must set `EXPO_PUBLIC_API_URL` in the EAS production environment.

---

## iOS App Store Release

The mobile app is configured as:

| Field | Value |
|---|---|
| App name | `HealthFolio` |
| Bundle ID | `com.starklabs.healthfolio` |
| SKU | `HEALTHFOLIO-IOS-001` |
| EAS project | `@starklabs/healthfolio` |
| Version | `1.0.0` |
| EAS profiles | `development`, `preview`, `production` |

Build and submit from the mobile workspace:

```bash
cd apps/mobile
npx --yes eas-cli@19 login
npx --yes eas-cli@19 project:info
npx --yes eas-cli@19 env:create --name EXPO_PUBLIC_API_URL --value https://api.example.com --environment production --visibility plaintext
npx --yes eas-cli@19 credentials:configure-build -p ios -e production
npm run build:ios
npm run submit:ios
```

See [docs/app-store-release.md](docs/app-store-release.md) for the full release checklist, App Store name findings, backend production environment, and review notes.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start API, worker, doctor-share, and mobile in parallel |
| `npm run build` | Build all workspaces via Turborepo |
| `npm run typecheck` | TypeScript check across all workspaces |
| `npm run lint` | ESLint across all workspaces |
| `npm run test` | Vitest (API, worker, packages) |
| `npm run db:up` | Start PostgreSQL + Redis via Docker Compose |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed the 80-parameter catalog and demo data |
| `npm run db:reset` | Tear down volumes, re-up, migrate, and seed |
| `npm run supabase:migrations` | List local/remote Supabase migration status |
| `npm run supabase:push` | Push Supabase migrations and catalog seed to the linked project |
| `npm run phi-scan` | Fail CI if raw `console.*` is used outside the phi-scrubber |
| `npm run cleanup:classify` | Bucket dirty files into safe review/commit groups |
| `npm run cleanup:scan` | Fail if dirty files include generated artifacts or likely secrets |
| `npm run cleanup:verify` | Run the cleanup verification gate from a no-space `/tmp` snapshot |
| `npm run cleanup:verify:native` | Run cleanup verification plus `pod install` and an unsigned simulator build |

---

## API Overview

All endpoints require `Authorization: Bearer <token>` unless marked public.

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/otp/request` | Request OTP *(public)* |
| `POST` | `/auth/otp/verify` | Verify OTP → JWT tokens *(public)* |
| `GET` | `/me` | Authenticated user + health profile |
| `PUT` | `/me/health-profile` | Update health profile |
| `GET` | `/documents` | List documents |
| `POST` | `/documents` | Upload a document |
| `GET` | `/documents/:id` | Document detail + extracted readings |
| `GET` | `/readings` | Paginated readings (filterable by parameter, date, status) |
| `POST` | `/readings` | Manual reading entry |
| `GET` | `/readings/trend` | Trend data for a parameter |
| `POST` | `/family/invite` | Invite a family member |
| `POST` | `/family/accept` | Accept a family invite by token |
| `GET` | `/family/members` | List members with access to your data |
| `GET` | `/family/memberships` | List accounts you are a member of |
| `GET` | `/shares` | List active doctor share links |
| `POST` | `/shares` | Create a doctor share link |
| `DELETE` | `/shares/:id` | Revoke a share link |
| `GET` | `/public/share/:token` | Resolve share token *(public)* |
| `GET` | `/exports/pdf` | Stream health summary PDF |

---

## Architecture Notes

- **TypeScript strict mode** — `noUncheckedIndexedAccess`, `noUnusedLocals`, and `noUnusedParameters` are enforced across every workspace.
- **ResourceAccessGuard** — returns `404` (not `403`) on access denied to avoid leaking resource existence.
- **Route ordering** — literal routes (e.g. `GET /readings/trend`) are declared before wildcard routes (`GET /readings/:id`) in every NestJS controller to prevent routing conflicts.
- **PHI protection** — the `phi-scrubber` package wraps every logger; the `phi-scan` script blocks raw `console.*` calls in CI.
- **Family access** — active family-link members can access an owner's documents and readings by passing `?profileId=<ownerUserId>` to list endpoints; the `ResourceAccessGuard` validates the link.

---

## Platform Notes

- Docker Desktop must be running before executing any `db:*` scripts.
- All npm scripts use cross-platform equivalents (`wait-on`, `npm-run-all`) — no bash-isms.

---

## License

Private — all rights reserved.
