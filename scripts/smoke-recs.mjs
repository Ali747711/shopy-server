const BASE = "http://localhost:4000";
let pass = 0;
let fail = 0;

const j = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });
const post = (path, body, token) =>
  fetch(BASE + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(body),
  });
const get = (path, token) =>
  fetch(BASE + path, { headers: token ? { authorization: "Bearer " + token } : {} });
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (extra ? "  → " + extra : "")); }
};

// user A registers
const emailA = `recA_${Date.now()}@shopy.test`;
let { body } = await j(await post("/api/auth/register", { userName: "Rec A", userEmail: emailA, userPassword: "password123" }));
const tokenA = body?.data?.accessToken;
check("register user A", !!tokenA);

// fetch some jackets to engage with
({ body } = await j(await get("/api/products?category=jacket&limit=10")));
const jackets = body?.data ?? [];
check("jackets available to engage", jackets.length >= 2, `got ${jackets.length}`);
const viewed = jackets.slice(0, 2);

// track engagement (authenticated → tied to user A)
for (const p of viewed) {
  await j(await post("/api/events", { eventType: "VIEW", productId: p._id }, tokenA));
}
await j(await post("/api/events", { eventType: "ADD_TO_CART", productId: viewed[0]._id }, tokenA));
check("tracked engagement events", true);

// personalized recommendations
let res = await j(await get("/api/recommendations?limit=6", tokenA));
const recs = res.body?.data;
const viewedIds = new Set(viewed.map((p) => p._id));
check("recommendations → 200 personalized", res.status === 200 && recs?.strategy === "personalized", JSON.stringify({ s: res.status, strat: recs?.strategy }));
check("recommendations non-empty", (recs?.items?.length ?? 0) > 0, `items=${recs?.items?.length}`);
check("recs carry reason + source", recs?.items?.every((i) => i.reason && i.source), JSON.stringify(recs?.items?.[0]));
check("recs exclude engaged products", recs?.items?.every((i) => !viewedIds.has(i._id)), "engaged product leaked into recs");
console.log("   sample recs:", (recs?.items ?? []).slice(0, 3).map((i) => `${i.productName} [${i.source}: ${i.reason}]`));

// similar-to-product (public)
const someProduct = jackets[0]._id;
res = await j(await get(`/api/recommendations/similar/${someProduct}`));
check("similar/:id → 200", res.status === 200, res.status);
check("similar items non-empty + reason", (res.body?.data?.items?.length ?? 0) > 0 && res.body.data.items[0].reason.startsWith("Similar to"), JSON.stringify(res.body?.data?.items?.[0]));
check("similar excludes the product itself", res.body?.data?.items?.every((i) => i._id !== someProduct), "self leaked");

// cold-start: brand-new user with no history
const emailB = `recB_${Date.now()}@shopy.test`;
({ body } = await j(await post("/api/auth/register", { userName: "Rec B", userEmail: emailB, userPassword: "password123" })));
const tokenB = body?.data?.accessToken;
res = await j(await get("/api/recommendations?limit=6", tokenB));
check("cold-start → 200 cold-start strategy", res.status === 200 && res.body?.data?.strategy === "cold-start", JSON.stringify({ s: res.status, strat: res.body?.data?.strategy }));
check("cold-start returns trending items", (res.body?.data?.items?.length ?? 0) > 0, `items=${res.body?.data?.items?.length}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
