# Shopy Backend — API Contract

> Source of truth for frontend ↔ backend integration. Maintained by the `backend-api-liaison` agent. If this conflicts with the code, the code wins — ask the liaison to reconcile.

**Base URL (dev):** `http://localhost:4000`
**Content-Type:** `application/json` (except the Stripe webhook).

## Response envelope

Every JSON response uses:

```jsonc
// success
{ "success": true, "data": <T | array>, "error": null, "meta"?: { "total": 0, "page": 1, "limit": 20 } }
// error
{ "success": false, "data": null, "error": { "code": 404, "message": "No data found" } }
```

List endpoints put the array in `data` and pagination in `meta`.

**Status codes:** `200` ok · `201` created · `400` validation · `401` unauthenticated · `403` forbidden · `404` not found · `409` conflict (e.g. stock/duplicate) · `429` rate-limited · `500` server · `503` feature not configured (e.g. Stripe).

**Headers:** every response includes `X-Request-Id`. Rate-limited responses include `X-RateLimit-Limit/Remaining/Reset` and (on 429) `Retry-After`.

## Auth

- Send the access token as `Authorization: Bearer <accessToken>` (or rely on the `accessToken` httpOnly cookie set on login/register).
- Access token ≈ 15m; refresh token ≈ 7d (rotates on use).
- Roles: `USER` (default) and `ADMIN`. Admin-only routes return `403` for non-admins.

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| POST | `/api/auth/register` | – | `{ userName, userEmail, userPassword(min 8) }` | `201 { user, accessToken, refreshToken }` |
| POST | `/api/auth/login` | – | `{ userEmail, userPassword }` | `200 { user, accessToken, refreshToken }` |
| POST | `/api/auth/refresh` | refresh | `{ refreshToken }` (or cookie) | `200 { accessToken, refreshToken }` |
| POST | `/api/auth/logout` | Bearer | `{ refreshToken? }` | `200 { loggedOut: true }` |
| GET | `/api/auth/me` | Bearer | – | `200 { user }` |

`user` shape: `{ _id, userName, userEmail, userRole, userStatus, userPreferences:{ categories[], priceSensitivity }, createdAt, updatedAt }` (never includes password/refresh tokens).

## Products

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/products` | public | filters below; paginated |
| GET | `/api/products/:id` | public | `?currency=` supported |
| POST | `/api/products` | admin | create (auto-embeds for AI search) |
| PATCH | `/api/products/:id` | admin | partial update (re-embeds if name/desc/category/tags change) |
| DELETE | `/api/products/:id` | admin | soft delete |

**List query params:** `category`, `tags` (csv), `minPrice`, `maxPrice`, `search`, `sort` (`NEWEST|PRICE_ASC|PRICE_DESC|RATING`), `currency` (`USD|EUR|GBP|KWD|UZS`), `page` (default 1), `limit` (default 20, max 100).

**Product shape (read):**
```jsonc
{
  "_id": "…", "productName": "…", "productDescription": "…",
  "productCategory": "jacket", "productTags": ["lightweight"],
  "productPrice": 75,                 // USD base
  "productCurrency": "USD",
  "productStock": 40,
  "productImages": [{ "url": "…", "alt": "…" }],
  "productRatingAvg": 4.5, "productRatingCount": 12,
  "currency": "EUR",                  // echoes the ?currency you asked for
  "convertedPrice": 69.0,             // productPrice converted to `currency`
  "createdAt": "…", "updatedAt": "…"
}
```
> Display `convertedPrice` + `currency` to shoppers; `productPrice` is always the USD base. `convertedPrice` is absent only if you don't pass `?currency` (then it equals the USD price with `currency: "USD"`).

**Create/Update body (admin):** `{ productName, productDescription, productCategory, productTags?, productPrice (USD), productCurrency?, productStock?, productImages?, productAttributes? }`.

## Reviews (nested under a product)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/api/products/:id/reviews` | public | – | paginated (`page`, `limit`) |
| POST | `/api/products/:id/reviews` | Bearer | `{ rating (1-5 int), comment? }` | one per user; re-posting updates it (`201 { review }`) |
| DELETE | `/api/products/:id/reviews` | Bearer | – | deletes the caller's review |

Writing/deleting recomputes the product's `productRatingAvg` + `productRatingCount`. `review` shape: `{ _id, productId, userId, userName, rating, comment, createdAt, updatedAt }`.

## Events (behavior tracking)

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/events` | optional | `{ eventType, productId?, sessionId?, eventQuery?, eventMetadata? }` |

`eventType`: `VIEW | CLICK | ADD_TO_CART | PURCHASE | SEARCH`. If a Bearer token is present the event is tied to the user (feeds recommendations). Returns `201 { event }`.

## AI search (RAG)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/ai/search` | optional | `{ query (2–500 chars) }` | `200 { query, intent, products[], explanation, cached, degraded }` |
| POST | `/api/ai/search/stream` | optional | `{ query }` | **SSE** stream |

Rate limited to **15 / 60s** per IP. `products[]` items: `{ _id, productName, productDescription, productCategory, productPrice, productCurrency, productTags, score }`. `intent` ≈ `{ category?, minPrice?, maxPrice?, tags?, attributes?, keywords? }`. `degraded: true` means the daily AI budget was hit (no `explanation`).

**SSE events** (`text/event-stream`): `event: meta` → `{ intent, products, degraded, cached }`; then repeated `event: token` → `{ t: "…" }`; finally `event: done` → `{ explanation, cached }`. (`event: error` on failure.) Consume with `fetch` + a stream reader (not `EventSource`, since it's POST).

## Recommendations

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/recommendations` | Bearer | "recommended for you"; `?limit=`, `?explain=true` (LLM re-rank + personalized reasons) |
| GET | `/api/recommendations/similar/:productId` | public | "because you viewed X"; `?limit=` |

`/recommendations` → `200 { strategy: "personalized"|"cold-start", items[], cached }`. `/similar` → `200 { items[] }`. Each item: `{ _id, productName, productDescription, productCategory, productPrice, productCurrency, productTags, score, reason, source }` (`source`: `content|collaborative|trending|similar`).

## Orders

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/api/orders` | Bearer | `{ items:[{ productId, qty(1-999) }], currency?, paymentMethod? }` | `201 { order }`; validates + decrements stock |
| GET | `/api/orders` | Bearer | – | caller's orders, paginated (`page`,`limit`,`status?`) |
| GET | `/api/orders/:id` | Bearer | – | owner or admin only (else 403) |
| PATCH | `/api/orders/:id/status` | admin | `{ orderStatus }` | – |

`currency` ∈ `USD|EUR|GBP|KWD|UZS` (default USD). `paymentMethod` ∈ `COD|STRIPE` (default COD). `409` if insufficient stock. **Order shape:**
```jsonc
{
  "_id": "…", "userId": "…",
  "orderItems": [{ "productId": "…", "productName": "…", "qty": 2, "priceAtPurchase": 69.0 }],
  "orderTotal": 138.0,                // in orderCurrency, locked at purchase
  "orderCurrency": "EUR",
  "orderStatus": "PENDING",           // PENDING|PAID|SHIPPED|DELIVERED|CANCELLED
  "paymentMethod": "STRIPE",          // COD|STRIPE
  "paymentStatus": "UNPAID",          // UNPAID|PAID|FAILED|REFUNDED
  "createdAt": "…", "updatedAt": "…"
}
```

## Payments (Stripe Checkout + Cash on Arrival)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| GET | `/api/payments/config` | public | – | `200 { enabled, publishableKey }` |
| POST | `/api/payments/checkout` | Bearer | `{ orderId }` | `200 { url, sessionId }` — redirect the browser to `url` |
| POST | `/api/payments/webhook` | Stripe sig | raw | Stripe→backend only; flips order to PAID |

**Cash on Arrival:** create the order with `paymentMethod: "COD"`. It stays `paymentStatus: UNPAID` / `orderStatus: PENDING`; an admin settles it later via `PATCH /api/orders/:id/status`.

**Stripe online payment (frontend flow):**
1. Create the order with `paymentMethod: "STRIPE"` → get `order._id`.
2. `POST /api/payments/checkout { orderId }` → get `{ url }`.
3. `window.location.href = url` (Stripe-hosted page). Stripe redirects back to `CHECKOUT_SUCCESS_URL` / `CHECKOUT_CANCEL_URL` (defaults `http://localhost:3000/checkout/success|cancel`, configurable in backend `.env`), with `?order=<id>`.
4. The backend webhook marks the order `PAID` asynchronously — the success page should re-fetch the order (`GET /api/orders/:id`) to confirm, not assume.

> Online payment returns `503` if Stripe isn't configured on the backend. Completing payment locally requires `STRIPE_WEBHOOK_SECRET` (from `stripe listen`). Use `GET /api/payments/config` to decide whether to show the online-payment option.

## Currencies & FX

Supported: `USD` (base), `EUR`, `GBP`, `KWD`, `UZS`. Conversion uses static rates on the backend (`src/config/currency.ts`). Display rounding: USD/EUR/GBP 2 dp, KWD 3 dp, UZS 0 dp. The frontend never computes prices — always read `convertedPrice` (products) or `orderTotal` (orders) from the API.
