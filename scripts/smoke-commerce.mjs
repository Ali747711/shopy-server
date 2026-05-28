const BASE = "http://localhost:4000";
let pass = 0;
let fail = 0;

const j = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });
const req = (method, path, body, token) =>
  fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (extra ? "  → " + extra : "")); }
};
const round2 = (n) => Math.round(n * 100) / 100;

// register
let { body } = await j(await req("POST", "/api/auth/register", { userName: "Shopper", userEmail: `shop_${Date.now()}@shopy.test`, userPassword: "password123" }));
const token = body?.data?.accessToken;
check("register", !!token);

// ---- Multi-currency ----
let res = await j(await req("GET", "/api/products?limit=5&currency=EUR"));
const p0 = res.body?.data?.[0];
check("products in EUR carry currency + convertedPrice", p0?.currency === "EUR" && typeof p0?.convertedPrice === "number", JSON.stringify({ c: p0?.currency, cp: p0?.convertedPrice }));
check("EUR conversion math (rate 0.92)", p0 && p0.convertedPrice === round2(p0.productPrice * 0.92), `${p0?.convertedPrice} vs ${round2(p0?.productPrice * 0.92)}`);

res = await j(await req("GET", "/api/products?limit=5&currency=BOGUS"));
const pb = res.body?.data?.[0];
check("invalid currency falls back to USD", pb?.currency === "USD" && pb?.convertedPrice === pb?.productPrice, JSON.stringify({ c: pb?.currency }));

const productId = p0._id;

// ---- Reviews ----
res = await j(await req("POST", `/api/products/${productId}/reviews`, { rating: 5, comment: "Great!" }, token));
check("create review → 201", res.status === 201, res.status);
res = await j(await req("POST", `/api/products/${productId}/reviews`, { rating: 3, comment: "Changed my mind" }, token));
check("re-review updates (upsert)", res.status === 201, res.status);
res = await j(await req("GET", `/api/products/${productId}/reviews`));
check("review list has exactly 1 (one per user)", res.body?.meta?.total === 1 && res.body?.data?.[0]?.rating === 3, JSON.stringify(res.body?.meta));
check("review carries userName", !!res.body?.data?.[0]?.userName, res.body?.data?.[0]?.userName);
res = await j(await req("GET", `/api/products/${productId}`));
check("product rating recomputed (avg 3, count 1)", res.body?.data?.product?.productRatingAvg === 3 && res.body?.data?.product?.productRatingCount === 1, JSON.stringify({ avg: res.body?.data?.product?.productRatingAvg, n: res.body?.data?.product?.productRatingCount }));
res = await j(await req("POST", `/api/products/${productId}/reviews`, { rating: 6 }, token));
check("review rating 6 → 400 validation", res.status === 400, res.status);
res = await j(await req("POST", `/api/products/${productId}/reviews`, { rating: 4 }));
check("review without auth → 401", res.status === 401, res.status);
res = await j(await req("DELETE", `/api/products/${productId}/reviews`, undefined, token));
check("delete review → 200", res.status === 200, res.status);

// ---- COD order (in EUR) ----
res = await j(await req("POST", "/api/orders", { items: [{ productId, qty: 1 }], currency: "EUR", paymentMethod: "COD" }, token));
const codOrder = res.body?.data?.order;
check("COD order → 201", res.status === 201 && !!codOrder, res.status);
check("COD: method COD, status UNPAID, currency EUR", codOrder?.paymentMethod === "COD" && codOrder?.paymentStatus === "UNPAID" && codOrder?.orderCurrency === "EUR", JSON.stringify({ m: codOrder?.paymentMethod, s: codOrder?.paymentStatus, c: codOrder?.orderCurrency }));

// ---- Stripe payments ----
res = await j(await req("GET", "/api/payments/config"));
check("payment config: enabled + publishable key", res.body?.data?.enabled === true && !!res.body?.data?.publishableKey, JSON.stringify(res.body?.data));

res = await j(await req("POST", "/api/orders", { items: [{ productId, qty: 1 }], currency: "USD", paymentMethod: "STRIPE" }, token));
const stripeOrder = res.body?.data?.order;
check("STRIPE order → 201", res.status === 201 && stripeOrder?.paymentMethod === "STRIPE", res.status);

res = await j(await req("POST", "/api/payments/checkout", { orderId: stripeOrder._id }, token));
check("checkout session → url + sessionId", res.status === 200 && /^https:\/\/checkout\.stripe\.com/.test(res.body?.data?.url || "") && /^cs_/.test(res.body?.data?.sessionId || ""), JSON.stringify({ s: res.status, url: (res.body?.data?.url || "").slice(0, 30) }));

res = await j(await req("POST", "/api/payments/checkout", { orderId: codOrder._id }, token));
check("checkout on COD order → 400", res.status === 400, res.status);

// webhook with bad signature → handled (400 invalid-sig, or 503 if no webhook secret)
res = await j(await req("POST", "/api/payments/webhook", { fake: true }, undefined));
check("webhook bad signature handled (400/503, not 500)", res.status === 400 || res.status === 503, res.status);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
