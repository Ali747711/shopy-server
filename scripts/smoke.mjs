import { MongoClient } from "mongodb";

const BASE = "http://localhost:4000";
let pass = 0;
let fail = 0;

const j = async (res) => ({
  status: res.status,
  body: await res.json().catch(() => ({})),
});
const post = (path, body, token) =>
  fetch(BASE + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    body: JSON.stringify(body),
  });
const get = (path, token) =>
  fetch(BASE + path, {
    headers: token ? { authorization: "Bearer " + token } : {},
  });

const check = (name, cond, extra) => {
  if (cond) {
    pass++;
    console.log("PASS  " + name);
  } else {
    fail++;
    console.log("FAIL  " + name + (extra ? "  → " + extra : ""));
  }
};

const email = `user_${Date.now()}@shopy.test`;
let r, status, body;

// register
({ status, body } = await j(
  await post("/api/auth/register", {
    userName: "Test User",
    userEmail: email,
    userPassword: "password123",
  })
));
check("register → 201 + tokens", status === 201 && body?.data?.accessToken, JSON.stringify(body));
const userToken = body?.data?.accessToken;
let refreshToken = body?.data?.refreshToken;

// me
({ status, body } = await j(await get("/api/auth/me", userToken)));
check("me → 200 self", status === 200 && body?.data?.user?.userEmail === email, status);

// duplicate email
({ status } = await j(
  await post("/api/auth/register", { userName: "Dup", userEmail: email, userPassword: "password123" })
));
check("duplicate register → 409", status === 409, status);

// login
({ status, body } = await j(await post("/api/auth/login", { userEmail: email, userPassword: "password123" })));
check("login → 200", status === 200 && body?.data?.accessToken, status);

// wrong password
({ status } = await j(await post("/api/auth/login", { userEmail: email, userPassword: "nope" })));
check("login wrong pw → 401", status === 401, status);

// refresh (rotation)
({ status, body } = await j(await post("/api/auth/refresh", { refreshToken })));
check("refresh → 200 new tokens", status === 200 && body?.data?.accessToken, JSON.stringify(body));

// validation failure
({ status } = await j(
  await post("/api/auth/register", { userName: "x", userEmail: "bad", userPassword: "123" })
));
check("register validation → 400", status === 400, status);

// product create without auth
({ status } = await j(
  await post("/api/products", { productName: "X", productDescription: "Y", productCategory: "jacket", productPrice: 50 })
));
check("product create no-auth → 401", status === 401, status);

// product create as normal user
({ status } = await j(
  await post(
    "/api/products",
    { productName: "X", productDescription: "Y", productCategory: "jacket", productPrice: 50 },
    userToken
  )
));
check("product create as user → 403", status === 403, status);

// promote to admin in DB
const client = new MongoClient("mongodb://localhost:27017");
await client.connect();
await client.db("shopy").collection("users").updateOne({ userEmail: email }, { $set: { userRole: "ADMIN" } });
await client.close();
check("promote user → ADMIN", true);

// re-login to mint admin-scoped token
({ status, body } = await j(await post("/api/auth/login", { userEmail: email, userPassword: "password123" })));
const adminToken = body?.data?.accessToken;
check("admin re-login → 200", !!adminToken, status);

// product create as admin
({ status, body } = await j(
  await post(
    "/api/products",
    {
      productName: "Lightweight Rain Jacket",
      productDescription: "Water-resistant lightweight jacket for rainy weather",
      productCategory: "jacket",
      productPrice: 75,
      productTags: ["lightweight", "rain"],
      productStock: 10,
    },
    adminToken
  )
));
const productId = body?.data?.product?._id;
check("product create as admin → 201", status === 201 && !!productId, JSON.stringify(body));

// list with filters
({ status, body } = await j(await get("/api/products?limit=10&maxPrice=80")));
check(
  "product list → 200 + meta",
  status === 200 && Array.isArray(body?.data) && body?.meta?.total >= 1,
  JSON.stringify(body?.meta)
);

// get by id
({ status, body } = await j(await get("/api/products/" + productId)));
check("product get by id → 200", status === 200 && body?.data?.product?._id === productId, status);

// track event (anonymous)
({ status, body } = await j(await post("/api/events", { eventType: "VIEW", productId })));
check("event track (anon) → 201", status === 201, JSON.stringify(body));

// logout
({ status } = await j(await post("/api/auth/logout", { refreshToken }, adminToken)));
check("logout → 200", status === 200, status);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
