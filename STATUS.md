# Shopy Backend — Build Status

> **Purpose:** Single source of truth for *where we are*. Read this first at the start of every session, update it at the end. Pairs with [`system-design.md`](./system-design.md) (the *what/why*).

**Last updated:** 2026-05-28
**Current phase:** Phase 0 complete ✅ → Phase 1 next

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
- [ ] **Phase 1 — Core domain**
  - [ ] Auth: register / login / refresh / logout / me + `verifyAuth` + RBAC (`verifyAdmin`)
  - [ ] Product CRUD (admin-gated writes) + listing with filters/pagination
  - [ ] Events ingestion (`POST /api/events`)
  - [ ] Zod `validate(schema)` middleware at request boundary
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
2. **Auth token model.** Design doc = access + refresh (rotation/revocation). House style = single JWT in httpOnly cookie. Pick one at start of Phase 1. (Leaning access+refresh per design doc; `.env` already has both secrets + TTLs.)
3. **Response envelope vs raw house-style controllers.** We chose the envelope. House-style controllers normally return raw objects + the `Errors` object. Keep envelope consistent across all Phase 1 controllers.

---

## Environment / Secrets

`.env` is populated and **git-ignored** (`.gitignore` in place). `.env.example` is the committed template.

- ✅ JWT secrets (generated), Mongo (local), Upstash Redis (REST URL+token), OpenAI key — all set
- Validated at startup by `config/env.ts` — server won't boot if a required var is missing

**Not a git repo yet.** Recommend `git init` before the first commit so `.env` is never staged.

---

## File Map (current)

```
src/
  config/    env.ts · db.ts · redis.ts
  libs/      Errors.ts · configs.ts
             types/common.ts
             utils/logger.ts · apiResponse.ts
  middlewares/ error.middleware.ts
  routes/    health.route.ts
  app.ts · server.ts
```

---

## Next Action

Start **Phase 1**: decide auth token model (open decision #2), then build the `user` domain end-to-end (enum → types → schema → service → controller → route), wire `validate()` Zod middleware, and mount under `/api/auth`. Then `product`, then `events`.
