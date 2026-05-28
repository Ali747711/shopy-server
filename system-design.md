# AI-Powered E-Commerce Platform — Backend System Design

### (AI Shopping Assistant + Recommendation Engine)

> **Scope of this document:** This file lives in `/backend` and is the design of record for the **server side** — API, data, auth, AI pipeline, and recommendation engine. Frontend concerns are referenced only where they shape an API contract.

---

## 1. Project Overview

A full-stack, AI-powered e-commerce platform that demonstrates production-grade integration of Large Language Models (LLMs), vector search, and a personalized recommendation system.

Beyond a traditional store, the backend exposes:

- **Natural-language product search** — "lightweight jacket for rainy weather under $80"
- **AI-driven recommendations** — content-based + collaborative + LLM reasoning
- **Context-aware shopping assistance** — retrieval-augmented answers grounded in real catalog data
- **Behavioral personalization** — events feed back into ranking

The goal is to mirror real-world AI patterns used by modern e-commerce companies, not a superficial chatbot bolt-on.

---

## 2. Objectives

- Build a production-level backend (clean layering, testable, observable).
- Demonstrate *practical* AI integration (RAG grounded in the catalog, not hallucinated answers).
- Implement scalable architecture with clear service boundaries.
- Make engineering trade-offs explicit (cost, latency, accuracy).
- Deliver a portfolio-grade project aligned with current industry demands.

### Non-Functional Targets (initial)

| Concern | Target |
|---|---|
| Catalog read latency (p95) | < 200 ms (cached), < 500 ms (cold) |
| AI search latency (p95) | < 2.5 s end-to-end (streaming first token < 800 ms) |
| Availability | 99.5% (single region, portfolio scope) |
| Test coverage | ≥ 80% (unit + integration) |
| Max LLM spend guardrail | Configurable per-day budget with cache-first reads |

---

## 3. Design Decisions & Assumptions

These resolve the "A or B" choices in the original outline. They are **recommendations** — flagged so you can override before implementation begins.

| Area | Decision | Rationale |
|---|---|---|
| Runtime / framework | **Node.js + Express 5 (TypeScript)** | REST-first API design (`/api/...`) maps cleanly to Express; lighter than NestJS for this scope. Switch to NestJS only if we want DI/modules out of the box. |
| ODM | **Mongoose** | Schema validation + middleware hooks; pairs with MongoDB. |
| Primary DB | **MongoDB (Atlas)** | Document model fits product metadata + flexible attributes. |
| Vector store | **MongoDB Atlas Vector Search** (primary) | Keeps vectors *next to* product docs — one datastore, one query path, no sync job. Pinecone remains the fallback if we outgrow Atlas limits. |
| LLM provider | **OpenAI API** (`gpt-4o-mini` for routing/intent, `gpt-4o` for explanations) | Tiered model use controls cost. |
| Embeddings | **OpenAI `text-embedding-3-small`** (1536-dim) | Cheap, strong recall; upgrade to `-large` if recall is weak. |
| Cache | **Redis** | Embedding cache, AI response cache, rate-limit counters, hot product reads. |
| Validation | **Zod** at every boundary | Single source of truth for request shapes + inferred TS types. |
| Auth | **JWT access + refresh tokens** | Stateless access token; rotating refresh token stored server-side for revocation. |

**Key simplification vs. the original outline:** dropping a *separate* vector DB in favor of Atlas Vector Search removes an entire embedding-sync subsystem. Revisit only if vector volume or QPS exceeds Atlas tiers.

---

## 4. System Architecture

### 4.1 High-Level Flow

```
                 ┌─────────────────────────┐
                 │   Frontend (Next.js)    │
                 └────────────┬────────────┘
                              │  HTTPS / REST
                 ┌────────────▼────────────┐
                 │   API Layer (Express)   │
                 │  routes → controllers   │
                 │  middleware: auth, RBAC,│
                 │  validation, rate-limit │
                 └─────┬───────────┬───────┘
            ┌──────────┘           └──────────┐
            ▼                                 ▼
   ┌─────────────────┐               ┌──────────────────┐
   │  Domain Services │               │    AI Service     │
   │ product / order  │               │  intent → embed   │
   │ user / events    │               │  → vector search  │
   └────────┬─────────┘               │  → LLM explain    │
            │                         └────────┬──────────┘
            │                                  │
   ┌────────▼──────────────────────────────────▼─────────┐
   │                     Data Layer                        │
   │  MongoDB (users, products, orders, events)            │
   │  MongoDB Atlas Vector Search (product embeddings)     │
   │  Redis (cache, rate limits, AI/embedding cache)       │
   └───────────────────────────────────────────────────────┘
            ▲
            │ (reads behavior + catalog)
   ┌────────┴─────────┐
   │  Recommendation   │
   │     Service       │
   └───────────────────┘
```

### 4.2 Layering (request lifecycle)

```
Route → Middleware (auth, validate, rate-limit) → Controller → Service → Repository → DB
                                                       │
                                                       └→ AI / Recommendation services
```

- **Controllers** are thin: parse → call service → format response envelope.
- **Services** hold business logic; no Express objects leak in.
- **Repositories** wrap Mongoose models (Repository pattern) so storage is swappable and mockable in tests.

---

## 5. Tech Stack

**Backend:** Node.js, Express 5, TypeScript, Mongoose
**Database:** MongoDB Atlas (primary + Atlas Vector Search)
**Cache:** Redis
**AI:** OpenAI (LLM + embeddings); LangChain optional, only if orchestration grows complex
**Validation:** Zod
**Auth:** JWT (access + refresh), bcrypt for password hashing
**Logging:** Pino (structured JSON) + pino-http
**Testing:** Jest (unit/integration), Supertest (HTTP), k6 (load)
**DevOps:** Docker, GitHub Actions (CI/CD), deploy to Railway/Render
**Frontend (context only):** Next.js (App Router), React, Tailwind, shadcn/ui

---

## 6. Backend Project Structure

```
/backend
  /src
    /config          # env loading (Zod-validated), db, redis, openai clients
    /routes          # express routers, grouped by domain
    /controllers     # thin HTTP handlers
    /services        # business logic
      /ai            # intent extraction, RAG pipeline, prompt assembly
      /recommendation# content-based, collaborative, ranking
    /repositories    # data-access wrappers over models
    /models          # mongoose schemas
    /middlewares     # auth, rbac, validate, rateLimit, errorHandler, logger
    /schemas         # zod request/response schemas (DTOs)
    /utils           # response envelope, errors, pagination, helpers
    /jobs            # embedding backfill, recommendation precompute
    app.ts           # express app assembly
    server.ts        # bootstrap (db connect, listen)
  /tests
    /unit
    /integration
  /docs
    system-design.md
  .env.example
  Dockerfile
  package.json
  tsconfig.json
```

---

## 7. Data Models

MongoDB collections (Mongoose schemas). Field lists are indicative, not exhaustive.

### 7.1 `users`
```
{
  _id, email (unique, indexed), passwordHash,
  name, role: "user" | "admin",
  preferences: { categories: [string], priceSensitivity: "low"|"medium"|"high" },
  refreshTokens: [{ tokenHash, expiresAt, createdAt }],  // rotation + revocation
  createdAt, updatedAt
}
```

### 7.2 `products`
```
{
  _id, title (text-indexed), description (text-indexed),
  category, tags: [string],
  price, currency, stock,
  images: [{ url, alt }],
  attributes: { color, size, material, ... },   // flexible
  embedding: [float x1536],                       // Atlas Vector Search index
  embeddingModel: string, embeddedAt: Date,       // for re-embed detection
  ratingAvg, ratingCount,
  createdAt, updatedAt
}
```
Indexes: text index on `title`/`description`; standard index on `category`, `price`, `tags`; vector index on `embedding`.

### 7.3 `orders`
```
{
  _id, userId (indexed),
  items: [{ productId, qty, priceAtPurchase }],
  total, currency, status: "pending"|"paid"|"shipped"|"delivered"|"cancelled",
  createdAt, updatedAt
}
```

### 7.4 `events` (behavior tracking)
```
{
  _id, userId (nullable for anon), sessionId,
  type: "view" | "click" | "add_to_cart" | "purchase" | "search",
  productId (nullable), query (nullable),
  metadata: {}, createdAt (indexed)
}
```
Append-only. Drives recommendations + analytics. Consider TTL or archival for raw events.

### 7.5 `recommendation_cache` (optional, Redis or Mongo)
Precomputed "recommended for you" lists keyed by `userId`, with `generatedAt` and TTL.

---

## 8. API Design

All responses use a **consistent envelope**:

```jsonc
// success
{ "success": true, "data": { ... }, "error": null, "meta": { /* pagination */ } }
// error
{ "success": false, "data": null, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

Standard codes: `200/201` success, `400` validation, `401` unauthenticated, `403` forbidden, `404` not found, `409` conflict, `429` rate-limited, `500` server error.

### 8.1 Authentication
| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| POST | `/api/auth/register` | public | `{ email, password, name }` → user + tokens |
| POST | `/api/auth/login` | public | `{ email, password }` → access + refresh |
| POST | `/api/auth/refresh` | refresh token | rotates refresh, returns new access |
| POST | `/api/auth/logout` | auth | revokes refresh token |
| GET | `/api/auth/me` | auth | current user profile |

### 8.2 Products
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/products` | public | filters: `category`, `minPrice`, `maxPrice`, `tags`, `q`; paginated (`page`, `limit`, `sort`) |
| GET | `/api/products/:id` | public | single product |
| POST | `/api/products` | admin | create (triggers embedding generation) |
| PATCH | `/api/products/:id` | admin | update (re-embeds if title/description/tags change) |
| DELETE | `/api/products/:id` | admin | soft delete preferred |

### 8.3 AI Search
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/ai/search` | optional | streaming supported (SSE) |

Request:
```json
{ "query": "lightweight jacket under $80", "stream": true }
```
Response:
```json
{
  "success": true,
  "data": {
    "intent": { "category": "jacket", "maxPrice": 80, "attributes": ["lightweight"] },
    "products": [ { "id": "...", "title": "...", "score": 0.82 } ],
    "explanation": "These are lightweight and water-resistant, all under $80..."
  },
  "error": null
}
```

### 8.4 Recommendations
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/recommendations` | auth | "recommended for you" |
| GET | `/api/recommendations/similar/:productId` | public | "because you viewed X" |

### 8.5 Events
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/events` | optional | `{ type, productId?, query?, metadata? }` |

---

## 9. AI Pipeline (RAG)

```
query
  └─► 1. Intent extraction (gpt-4o-mini)  → { category, price bounds, attributes }
        └─► 2. Embed query (text-embedding-3-small, cache by query hash)
              └─► 3. Vector search (Atlas) + structured filters from intent (hybrid)
                    └─► 4. Context assembly (top-K products → prompt)
                          └─► 5. Explanation generation (gpt-4o, streamed)
                                └─► 6. Log search event
```

**Hybrid search:** intent-derived filters (price ≤ 80, category = jacket) are applied as MongoDB predicates *alongside* vector similarity, so results are both relevant and constraint-correct. This directly addresses "irrelevant AI results."

**Cost & latency controls:**
- Cache query embeddings and AI explanations in Redis (key = normalized query hash).
- Tiered models: cheap model for intent/routing, expensive model only for the final explanation.
- Stream the explanation (SSE) so perceived latency is low.
- Daily spend guardrail in config; degrade gracefully to non-AI keyword search if exceeded.

---

## 10. Recommendation System Design

**Inputs:** user history (`events`, `orders`), product metadata, embeddings.

**Strategies (blended):**
1. **Content-based** — similarity between products the user engaged with and the catalog (vector + tag overlap).
2. **Collaborative** — co-engagement signals ("users who viewed X also viewed Y") from `events`.
3. **LLM reasoning** — re-rank / explain the top candidates ("budget-friendly outdoor items").

**Cold-start handling:**
- New user → popularity + category trends (no history).
- New product → content-based only until it accrues events.

**Output:** ranked product list + an **explainability** string per recommendation, surfaced to build trust.

**Compute strategy:** precompute "recommended for you" via a scheduled job into `recommendation_cache`; compute "similar to X" on demand (cheap vector query).

---

## 11. Middleware

| Middleware | Responsibility |
|---|---|
| `auth` | Verify JWT access token, attach `req.user` |
| `rbac` | Enforce role (`user` / `admin`) |
| `validate(schema)` | Zod-validate body/query/params; 400 on failure |
| `rateLimit` | Redis-backed token bucket per IP / per user; stricter on `/api/ai/*` |
| `logger` | pino-http request logging with correlation id |
| `errorHandler` | Centralized; maps known `AppError` types to envelope, hides internals on 500 |

---

## 12. Configuration & Secrets

`.env` (validated by Zod at startup — fail fast if missing):

```
NODE_ENV, PORT
MONGODB_URI
REDIS_URL
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
JWT_ACCESS_TTL, JWT_REFRESH_TTL
OPENAI_API_KEY
OPENAI_CHAT_MODEL, OPENAI_INTENT_MODEL, OPENAI_EMBED_MODEL
AI_DAILY_BUDGET_USD
RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX
```

Secrets never hardcoded; `.env.example` committed, real `.env` git-ignored.

---

## 13. Security

- JWT auth (short-lived access + rotating refresh, server-side revocation).
- bcrypt password hashing (cost ≥ 12).
- Zod input validation on every endpoint.
- Redis-backed rate limiting (tighter on AI endpoints due to cost).
- Helmet headers, CORS allow-list, HTTPS enforced in production.
- No sensitive data in error responses or logs (redact tokens/PII).
- Secret management via environment / secret store.

---

## 14. Observability

- **Structured logs** (Pino JSON) with request correlation ids.
- **Metrics:** request latency, AI latency, cache hit rate, LLM token spend, error rate.
- **AI-specific:** log intent extraction quality samples, vector-search scores, cache hit ratio to tune cost/accuracy.

---

## 15. Testing Strategy

- **Unit** (Jest): services, ranking logic, prompt assembly, repositories (mocked).
- **Integration** (Supertest + ephemeral Mongo/Redis): auth flow, product CRUD, AI search with a mocked OpenAI client.
- **E2E:** critical flows (register → search → recommend).
- **Load** (k6): catalog reads and AI search under concurrency.
- Coverage target ≥ 80%.

---

## 16. Deployment

- Docker image; deploy to Railway/Render.
- GitHub Actions: lint → typecheck → test → build → deploy.
- Separate staging and production environments + configs.
- MongoDB Atlas + managed Redis.

---

## 17. Phased Roadmap

| Phase | Deliverable |
|---|---|
| **0 — Foundation** | Project scaffold, config/Zod, DB+Redis connect, error envelope, logging, health check |
| **1 — Core domain** | Auth (register/login/refresh/RBAC), product CRUD, events ingestion |
| **2 — AI search** | Embedding on product write, Atlas vector index, intent extraction, hybrid RAG search, caching |
| **3 — Recommendations** | Content-based + collaborative blend, cold-start, explainability, precompute job |
| **4 — Hardening** | Rate limiting, load tests, observability, CI/CD, deploy |

---

## 18. Challenges & Solutions

| Challenge | Solution |
|---|---|
| Irrelevant AI results | Hybrid search (vector + structured filters from intent); tune embeddings/top-K |
| Slow responses | Redis caching, SSE streaming, tiered models |
| High API cost | Cache embeddings + explanations, cheap model for routing, daily budget guardrail |
| Cold start (recs) | Popularity/trending fallback for new users; content-based for new products |
| Embedding drift | Store `embeddingModel`/`embeddedAt`; backfill job re-embeds on model change |

---

## 19. Future Improvements

- Visual search (image upload → image embeddings).
- Voice-based assistant.
- Multi-language support (Korean / English).
- Autonomous shopping agent.
- Real-time analytics dashboard.

---

## 20. Conclusion

This backend demonstrates real-world AI integration (grounded RAG, hybrid search, explainable recommendations), a cleanly layered and testable architecture, and explicit engineering trade-offs around cost, latency, and accuracy — reflecting industry-level problem solving rather than a basic portfolio project.
