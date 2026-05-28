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
const patch = (path, body, token) =>
  fetch(BASE + path, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(body),
  });
const get = (path, token) =>
  fetch(BASE + path, { headers: token ? { authorization: "Bearer " + token } : {} });
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log("PASS  " + name); }
  else { fail++; console.log("FAIL  " + name + (extra ? "  → " + extra : "")); }
};

// register buyer
const email = `buyer_${Date.now()}@shopy.test`;
let { body } = await j(await post("/api/auth/register", { userName: "Buyer", userEmail: email, userPassword: "password123" }));
const token = body?.data?.accessToken;
check("register buyer", !!token);

// pick two products to buy
({ body } = await j(await get("/api/products?limit=10")));
const all = body?.data ?? [];
const backpack = all.find((p) => p.productCategory === "backpack") || all[0];
const headphones = all.find((p) => p.productCategory === "headphones") || all[1];
check("products available", !!backpack && !!headphones);

const beforeStock = backpack.productStock;

// create order
let res = await j(await post("/api/orders", { items: [{ productId: backpack._id, qty: 2 }, { productId: headphones._id, qty: 1 }] }, token));
const order = res.body?.data?.order;
const expectedTotal = backpack.productPrice * 2 + headphones.productPrice;
check("create order → 201", res.status === 201 && !!order, JSON.stringify({ s: res.status }));
check("order total computed", order?.orderTotal === expectedTotal, `${order?.orderTotal} vs ${expectedTotal}`);
check("order status PENDING", order?.orderStatus === "PENDING", order?.orderStatus);

// stock decremented
res = await j(await get(`/api/products/${backpack._id}`));
check("stock decremented by qty", res.body?.data?.product?.productStock === beforeStock - 2, `${res.body?.data?.product?.productStock} vs ${beforeStock - 2}`);

// list my orders
res = await j(await get("/api/orders", token));
check("my orders → 200 + meta", res.status === 200 && Array.isArray(res.body?.data) && res.body?.meta?.total >= 1, JSON.stringify(res.body?.meta));

// get order by id (owner)
res = await j(await get(`/api/orders/${order._id}`, token));
check("get own order → 200", res.status === 200 && res.body?.data?.order?._id === order._id, res.status);

// another user cannot read it
({ body } = await j(await post("/api/auth/register", { userName: "Other", userEmail: `other_${Date.now()}@shopy.test`, userPassword: "password123" })));
res = await j(await get(`/api/orders/${order._id}`, body?.data?.accessToken));
check("other user blocked from order → 403", res.status === 403, res.status);

// non-admin cannot update status
res = await j(await patch(`/api/orders/${order._id}/status`, { orderStatus: "PAID" }, token));
check("non-admin status update → 403", res.status === 403, res.status);

// insufficient stock (999 is within the validator's qty cap but exceeds any seeded stock)
res = await j(await post("/api/orders", { items: [{ productId: backpack._id, qty: 999 }] }, token));
check("insufficient stock → 409", res.status === 409, res.status);

// purchase fed recommendations (PURCHASE event → engagement)
res = await j(await get("/api/recommendations?limit=6", token));
check("recs personalized after purchase", res.status === 200 && res.body?.data?.strategy === "personalized", JSON.stringify({ s: res.status, strat: res.body?.data?.strategy }));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
