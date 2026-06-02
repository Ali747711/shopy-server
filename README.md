# Shopy — AI-Powered E-Commerce Backend

A production-ready REST API for an AI-powered online store. Built with Express 5 + TypeScript (CommonJS) + Mongoose + MongoDB Atlas, with OpenAI for semantic search, a conversational shopping assistant, and a personalized recommendation engine.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 + TypeScript (CommonJS) |
| Framework | Express 5 |
| Database | MongoDB Atlas (Mongoose ODM) |
| Cache / Rate-limit | Upstash Redis (REST) |
| AI | OpenAI — `gpt-4o`, `gpt-4o-mini`, `text-embedding-3-small` |
| Payments | Stripe Checkout + Webhooks |
| Auth | JWT access + refresh tokens (httpOnly cookies + response body) |
| Validation | Zod |

---

## Project Structure

```
src/
  config/       env.ts · db.ts · redis.ts · openai.ts · currency.ts
  libs/
    Errors.ts               Custom HttpCode + Message enums + Errors class
    enums/                  user · product · event · currency enums
    types/                  common · user · product · event · ai types
    utils/                  logger · apiResponse · httpCatch
  middlewares/  error · validate · rateLimit · requestId
  schemas/      user · product · event (Mongoose models)
  services/
    ai/         embedding · search · chat · cost · vector services
    auth · user · product · event · recommendation · order services
  controllers/  user · product · event · ai · recommendation · order · payment
  validators/   user · product · event · ai · order · payment (Zod schemas)
  routes/       health · user · product · event · ai · recommendation · order · payment
  app.ts        Express app setup (middleware stack)
  server.ts     HTTP server bootstrap + graceful shutdown
scripts/
  seed.ts                   Seed 8 sample products (dev only)
  seed-temu.ts              Import scraped catalog (7 categories, 560 products)
  create-vector-index.ts    Create Atlas vector search index
  make-admin.ts             Promote a user to ADMIN role
  smoke*.mjs                Integration smoke tests
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB Atlas cluster (free M0 works; vector search requires M0+)
- Upstash Redis account (free tier works)
- OpenAI API key
- Stripe account (optional — payment endpoints return 503 without it)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in every value:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string (`mongodb+srv://...`) |
| `MONGODB_DB_NAME` | Database name (default: `shopy`) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `JWT_ACCESS_SECRET` | Secret for access tokens (min 16 chars) |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens (min 16 chars) |
| `JWT_ACCESS_TTL` | Access token TTL (default: `15m`) |
| `JWT_REFRESH_TTL` | Refresh token TTL (default: `7d`) |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_CHAT_MODEL` | Chat model (default: `gpt-4o`) |
| `OPENAI_INTENT_MODEL` | Intent extraction model (default: `gpt-4o-mini`) |
| `OPENAI_EMBED_MODEL` | Embedding model (default: `text-embedding-3-small`) |
| `AI_DAILY_BUDGET_USD` | Max daily AI spend in USD (default: `5`) |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_...`) — optional |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_...`) — optional |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret — optional |
| `CHECKOUT_SUCCESS_URL` | Redirect after successful Stripe checkout |
| `CHECKOUT_CANCEL_URL` | Redirect after cancelled Stripe checkout |
| `RATE_LIMIT_WINDOW_MS` | Global rate-limit window in ms (default: `900000`) |
| `RATE_LIMIT_MAX` | Max requests per window (default: `100`) |
| `CORS_ORIGIN` | Allowed CORS origin (default: `http://localhost:3000`) |

The server exits immediately at startup if any required variable is missing.

### 3. Run in development

```bash
npm run dev
```

Server starts at `http://localhost:4000`. Health check: `GET /health`.

### 4. Seed the database

```bash
# Seed 8 sample products with embeddings
npm run seed

# OR seed 560 real products scraped from Temu (7 categories)
npm run seed:temu
```

### 5. Create the vector search index (one-time)

Required for AI semantic search and recommendations:

```bash
npm run create-index
```

Run this once per database. Re-run only if the index is deleted.

### 6. Make a user admin

```bash
npm run make-admin -- "email@example.com"
```

Then log in again to get a new token with the ADMIN role.

---

## API Reference

All responses use the envelope format:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": { "total": 100, "page": 1, "limit": 20 }
}
```

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Reports Mongo + Redis status |

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Register a new user |
| `POST` | `/api/auth/login` | — | Login, returns access + refresh tokens |
| `POST` | `/api/auth/refresh` | — | Rotate refresh token, issue new access token |
| `POST` | `/api/auth/logout` | Bearer | Revoke refresh token |
| `GET` | `/api/auth/me` | Bearer | Get current user profile |

**Register / Login body:**
```json
{ "userEmail": "you@example.com", "userPassword": "secret123", "userName": "Ali" }
```

**Token delivery:** tokens are returned in the response body **and** set as `httpOnly` cookies (`accessToken` / `refreshToken`).

### Products

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/products` | — | List products (paginated, filterable) |
| `GET` | `/api/products/:id` | — | Get single product |
| `POST` | `/api/products` | Admin | Create product |
| `PATCH` | `/api/products/:id` | Admin | Update product |
| `DELETE` | `/api/products/:id` | Admin | Soft-delete product |

**List query params:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `category` | string | Filter by category |
| `tags` | string or string[] | Filter by tags |
| `minPrice` | number | Minimum price (USD) |
| `maxPrice` | number | Maximum price (USD) |
| `search` | string | Keyword search (name + description) |
| `sort` | `NEWEST\|PRICE_ASC\|PRICE_DESC\|RATING` | Sort order |
| `currency` | `USD\|EUR\|GBP\|KWD\|UZS` | Returns `convertedPrice` alongside `productPrice` |

### AI Search

Rate limited: **15 requests / 60 seconds** per user/IP.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/ai/search` | Optional | Semantic search — returns `{ intent, products[], explanation, cached, degraded }` |
| `POST` | `/api/ai/search/stream` | Optional | Same but SSE — emits `meta` → `token`… → `done` |

**Body:** `{ "query": "lightweight rain jacket under $100" }`

### AI Shopping Chat

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/ai/chat/stream` | Optional | Multi-turn shopping assistant over SSE |

**Body:**
```json
{
  "messages": [
    { "role": "user", "content": "I need a backpack for college" },
    { "role": "assistant", "content": "What's your budget?" },
    { "role": "user", "content": "Around $50" }
  ]
}
```

**SSE events emitted:**

| Event | Payload | Description |
|---|---|---|
| `products` | `{ products: [...] }` | Grounded product results (when tool call fires) |
| `token` | `{ t: "..." }` | Streaming text token |
| `done` | `{}` | Stream complete |
| `error` | `{ message: "..." }` | Error during processing |

The assistant asks at most two clarifying questions, then calls an internal `search_products` tool to ground recommendations in the live catalog. Falls back to keyword search if the daily AI budget is exhausted.

### Recommendations

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/recommendations` | Required | Personalized feed (content-based → collaborative → trending) |
| `GET` | `/api/recommendations/similar/:productId` | — | "Similar to this product" |

**Query params for `GET /api/recommendations`:**

| Param | Description |
|---|---|
| `?explain=true` | LLM re-ranks results and adds a per-item `reason` (opt-in, budget-guarded) |

### Events

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/events` | Optional | Ingest user interaction events (VIEW, SEARCH, PURCHASE, etc.) |

Events feed the personalized recommendation engine. Anonymous events are accepted (no auth required).

### Orders

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/orders` | Required | Create an order (checks + decrements stock) |
| `GET` | `/api/orders` | Required | List own orders (paginated) |
| `GET` | `/api/orders/:id` | Required | Get order by ID (owner or admin) |
| `PATCH` | `/api/orders/:id/status` | Admin | Update order status |

**Payment methods:** `COD` (cash on delivery) or `STRIPE`.

### Payments

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/payments/config` | — | Returns Stripe publishable key |
| `POST` | `/api/payments/checkout` | Required | Create Stripe Checkout session for an order → `{ url }` |
| `POST` | `/api/payments/webhook` | — | Stripe webhook (marks order PAID on `checkout.session.completed`) |

**Stripe local setup:**
```bash
stripe listen --forward-to localhost:4000/api/payments/webhook
```
Copy the signing secret into `STRIPE_WEBHOOK_SECRET` in `.env`.

---

## Key Design Decisions

**Rate limiting** — Upstash sliding-window limiter. Global guard: 100 req / 15 min per user/IP. AI endpoints: 15 req / 60 s. Fails open if Redis is unreachable.

**AI budget guardrail** — A daily USD cap (`AI_DAILY_BUDGET_USD`) is tracked in Redis. When exceeded, all AI endpoints degrade gracefully to keyword search instead of returning errors.

**Embeddings** — Generated on product create/update via `text-embedding-3-small`, cached in Redis for 30 days. Atlas vector index (`product_vector_index`, 1536-dim cosine) powers hybrid search (vector + category/price filters).

**Multi-currency** — All prices are stored in USD. The `?currency` query param converts on the fly using static FX rates. Orders lock prices in the requested currency. Stripe charges use correct minor-unit rules per currency (zero-decimal UZS, 3-decimal KWD, etc.).

**Auth** — Access token (15 min) + refresh token (7 days, hashed SHA-256, stored server-side). Refresh tokens are rotated on use and revoked on logout. Both tokens are delivered in the response body and as `httpOnly` cookies.

**Observability** — `X-Request-Id` correlation header on every response, propagated through Morgan logs. Graceful shutdown on SIGTERM/SIGINT (drains HTTP connections, disconnects Mongo).

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server (nodemon + ts-node) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npm run type-check` | TypeScript type-check without emitting |
| `npm run seed` | Seed 8 sample products with embeddings |
| `npm run seed:temu` | Import full catalog (560 products, 7 categories) |
| `npm run create-index` | Create Atlas vector search index |
| `npm run make-admin -- "email"` | Promote user to ADMIN |

---

## Docker

```bash
# Build
docker build -t shopy-backend .

# Run (pass all required env vars)
docker run -p 4000:4000 --env-file .env shopy-backend
```

---

## Environment Variables Summary

See `.env.example` for the full template with descriptions. Required variables (server exits if missing): `MONGODB_URI`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `OPENAI_API_KEY`.
