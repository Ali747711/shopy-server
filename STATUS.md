# Shopy Backend — Build Status

> **Purpose:** Single source of truth for *where we are*. Read this first at the start of every session, update it at the end. Pairs with [`system-design.md`](./system-design.md) (the *what/why*).

**Last updated:** 2026-05-28
**Current phase:** Phase 1 complete ✅ → Phase 2 (AI search) next

---

## Snapshot

AI-powered e-commerce **backend**. Express 5 + TypeScript (CommonJS) + Mongoose + MongoDB, Upstash Redis (REST), OpenAI for AI search/RAG + recommendations. Built in Ali's house-style layered architecture (route → controller → service → schema, custom `Errors` class).

**Run it:** `npm run dev` (nodemon + ts-node) → http://localhost:4000 · health check at `/health`
**Build:** `npm run build` → `npm start` · **Type-check:** `npm run type-check`

---

## Phase Roadmap

- [x] **Phase 0 — Foundation**
  - [x] package.json + tsconfig (CommonJS, strict:false)
  - [x] `libs/Errors.ts` (HttpCode + Message enums + Errors class)
  - [x] `libs/configs.ts`, `libs/types/common.ts`, `libs/utils/logger.ts`
  - [x] `libs/utils/apiResponse.ts` — `{ success, data, error, meta }` envelope (`ok()` / `fail()`)
  - [x] `config/env.ts` — Zod-validated env, fails fast on missing vars
  - [x] `config/db.ts` (Mongoose), `config/redis.ts` (Upstash REST)
  - [x] `middlewares/error.middleware.ts` (notFound + errorHandler → envelope)
  - [x] `app.ts` (helmet, cors, json, cookieParser, compression, morgan) + `server.ts` bootstrap
  - [x] `/health` route (reports mongo + redis status) — **verified working**
- [x] **Phase 1 — Core domain** *(all 16 smoke-test flows passing)*
  - [x] Auth: register / login / refresh / logout / me + `verifyAuth` + `verifyAdmin` + `optionalAuth`
        — **access + refresh JWT** (refresh hashed SHA-256, stored server-side, rotated on use, revoked on logout)
  - [x] Product CRUD (admin-gated writes) + public listing with filters + pagination (`$facet` aggregation)
  - [x] Events ingestion (`POST /api/events`, optional auth — anonymous allowed)
  - [x] Zod `validate(schema)` middleware (handles Express 5 getter-only `req.query`)
- [ ] **Phase 2 — AI search (RAG)**
  - [ ] Embedding generation on product write
  - [ ] Vector index + hybrid search (vector + structured filters)
  - [ ] Intent extraction → context assembly → streamed explanation
  - [ ] Redis caching of embeddings + AI responses; daily budget guardrail
- [ ] **Phase 3 — Recommendations** (content-based + collaborative + cold-start + explainability)
- [ ] **Phase 4 — Hardening** (rate limiting, load tests, observability, CI/CD, deploy)

---

## Key Decisions Made

| Decision | Choice | Note |
|---|---|---|
| Framework | Express 5 + TypeScript | matches house style + REST design |
| Module system | **CommonJS** | switched from the `"type":"module"` npm-init default; house style is CommonJS + ts-node |
| ODM / DB | Mongoose + MongoDB (local for now) | see ⚠️ Atlas note below |
| Redis | **Upstash REST** (`@upstash/redis`) | uses `UPSTASH_REDIS_REST_URL` + `_TOKEN`, not `REDIS_URL` |
| Response shape | `{ success, data, error, meta }` envelope | per global rules + design doc; `Errors` class still thrown internally |
| Validation | Zod at boundaries | env validated now; request validation in Phase 1 |
| Auth | JWT access + refresh (planned) | design doc spec; house style uses single JWT — see open decision |

---

## ⚠️ Open Decisions / Watch-outs (resolve before the relevant phase)

1. **Vector search needs MongoDB Atlas.** `MONGODB_URI` currently points to **local Mongo** (`mongodb://localhost:27017/shopy`), which does **not** support Atlas Vector Search (needed in Phase 2). Before Phase 2: either switch to an Atlas cluster, or use an in-app cosine-similarity fallback. *(The `.env` has two `MONGODB_URI` lines — the local one wins; clean up before deploy.)*
2. ~~**Auth token model.**~~ ✅ **Resolved (Phase 1):** access + refresh, refresh hashed/rotated/revocable. Tokens returned in body envelope AND set as httpOnly cookies (`refreshToken` scoped to `/api/auth`).
3. **Response envelope vs raw house-style controllers.** We chose the envelope — applied consistently across all Phase 1 controllers via `ok()` / `fail()` + shared `catchHttp`.

---

## Environment / Secrets

`.env` is populated and **git-ignored** (`.gitignore` in place). `.env.example` is the committed template.

- ✅ JWT secrets (generated), Mongo (local), Upstash Redis (REST URL+token), OpenAI key — all set
- Validated at startup by `config/env.ts` — server won't boot if a required var is missing

**Not a git repo yet.** Recommend `git init` before the first commit so `.env` is never staged.

---

## API Surface (live)

- `GET  /health`
- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/refresh` · `POST /api/auth/logout` · `GET /api/auth/me`
- `GET  /api/products` (filters: category, tags, minPrice, maxPrice, search, sort, page, limit) · `GET /api/products/:id`
- `POST /api/products` · `PATCH /api/products/:id` · `DELETE /api/products/:id` *(admin only)*
- `POST /api/events` *(optional auth)*

**Verify locally:** `npx ts-node src/server.ts` in one shell, then `node scripts/smoke.mjs` → expect `16 passed, 0 failed`.
*(Smoke test promotes a user to ADMIN directly in Mongo since registration always creates USER — there's no self-serve admin signup by design.)*

## File Map (current)

```
src/
  config/      env.ts · db.ts · redis.ts
  libs/
    Errors.ts · configs.ts
    enums/     user.enum.ts · product.enum.ts · event.enum.ts
    types/     common.ts · user.ts · product.ts · event.ts
    utils/     logger.ts · apiResponse.ts · httpCatch.ts
  middlewares/ error.middleware.ts · validate.middleware.ts
  schemas/     user.schema.ts · product.schema.ts · event.schema.ts
  services/    auth.service.ts · user.service.ts · product.service.ts · event.service.ts
  controllers/ user.controller.ts · product.controller.ts · event.controller.ts
  validators/  user.validator.ts · product.validator.ts · event.validator.ts
  routes/      health.route.ts · user.route.ts · product.route.ts · event.route.ts
  app.ts · server.ts
scripts/       smoke.mjs
```

---

## Next Action

Start **Phase 2 — AI search (RAG)**. First resolve open decision #1 (vector store: switch `MONGODB_URI` to Atlas for Vector Search, or build an in-app cosine-similarity fallback over the existing `productEmbedding` field). Then: embed products on write (OpenAI `text-embedding-3-small`), intent extraction, hybrid search (vector + structured filters), streamed explanation, and Redis caching of embeddings/responses with the daily-budget guardrail.

**No admin seed yet** — if Phase 2 needs catalog data, add a seed script (`scripts/seed.*`) or a one-off admin-promotion utility.
