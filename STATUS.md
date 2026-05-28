# Shopy Backend — Build Status

> **Purpose:** Single source of truth for *where we are*. Read this first at the start of every session, update it at the end. Pairs with [`system-design.md`](./system-design.md) (the *what/why*).

**Last updated:** 2026-05-29
**Current phase:** Phase 3 complete ✅ → Phase 4 (Hardening) next

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
- [x] **Phase 2 — AI search (RAG)** *(verified live against Atlas + OpenAI)*
  - [x] Embedding generation on product write (best-effort; re-embeds on searchable-field update)
  - [x] Atlas vector index `product_vector_index` (1536-dim cosine + filter fields) + hybrid `$vectorSearch` (vector + category/price filters)
  - [x] Intent extraction (`gpt-4o-mini`) → context assembly → explanation (`gpt-4o`)
  - [x] Redis caching of embeddings (30d) + full search responses (1h); daily budget guardrail with graceful degrade + keyword fallback
  - [ ] _Deferred:_ SSE streaming of the explanation (returns full JSON for now)
- [x] **Phase 3 — Recommendations** *(12 smoke checks passing)*
  - [x] `GET /api/recommendations/similar/:productId` (public) — vector similarity to one product
  - [x] `GET /api/recommendations` (auth) — waterfall blend: content-based (weighted profile vector over engagement) → collaborative (co-engaged peers) → trending fill
  - [x] Cold-start: trending fallback (→ highest-rated/newest if no events) for users with no history
  - [x] Per-item explainability `reason` + `source`; engaged products excluded; Redis cached (similar 1h, personalized 10m)
  - [ ] _Note:_ engagement is **events-only** — orders aren't built yet (no order schema/endpoints), so PURCHASE weight only applies to PURCHASE events
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

1. ~~**Vector search needs MongoDB Atlas.**~~ ✅ **Resolved:** now on **MongoDB Atlas free M0** (`shopy.atzeheg.mongodb.net`), connection verified (`/health` → `mongo: up`). Vector Search available. Note: the Atlas `shopy` DB is **empty** — Phase 2 needs a seed script for products + embeddings.
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
- `POST /api/ai/search` *(optional auth)* — body `{ "query": "..." }` → `{ intent, products[], explanation, cached, degraded }`
- `GET  /api/recommendations` *(auth)* — "recommended for you" → `{ strategy, items[], cached }`
- `GET  /api/recommendations/similar/:productId` *(public)* — "because you viewed X"

**Verify locally:** `npx ts-node src/server.ts` in one shell, then `node scripts/smoke.mjs` (→ `16 passed`) and `node scripts/smoke-recs.mjs` (→ `12 passed`).
**Make an admin:** `npm run make-admin -- "email@x.com"`, then re-login.
*(Smoke test promotes a user to ADMIN directly in Mongo since registration always creates USER — there's no self-serve admin signup by design.)*

**AI / vector setup (one-time per DB):** `npm run seed` (loads 8 sample products + embeddings) → `npm run create-index` (creates `product_vector_index`, waits until queryable). Re-run `create-index` only if the index is dropped.

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
  config/      ... · openai.ts
  schemas/     user.schema.ts · product.schema.ts · event.schema.ts
  services/    auth · user · product · event · recommendation .service.ts
    ai/        embedding.service.ts · search.service.ts · cost.service.ts · vector.ts
  controllers/ user · product · event · ai · recommendation .controller.ts
  validators/  user · product · event · ai .validator.ts
  routes/      health · user · product · event · ai · recommendation .route.ts
  app.ts · server.ts
scripts/       smoke.mjs · smoke-recs.mjs · seed.ts · create-vector-index.ts · make-admin.ts
postman/       shopy.postman_collection.json
```

---

## Next Action

Start **Phase 4 — Hardening**:
- Rate limiting (Upstash `@upstash/ratelimit`) — global + stricter on `/api/ai/*` (cost protection).
- Observability: request id correlation, AI metrics (latency, cache-hit, token spend).
- CI (GitHub Actions): typecheck + build + smoke tests.
- Dockerfile + deploy config (Railway/Render).
- Load test (k6) on catalog + AI search.

**Deferred / possible side quests:**
- Orders domain (schema + endpoints) → lets recommendations weight real purchases.
- SSE streaming for `/api/ai/search`.
- LLM re-ranking/explanation layer for recommendations (currently rule-based reasons).
