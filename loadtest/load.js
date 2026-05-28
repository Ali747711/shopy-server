// k6 load test — run with:  k6 run loadtest/load.js
// Optional: BASE_URL=https://your-host k6 run loadtest/load.js
//
// Exercises the cacheable read paths (health + catalog). The AI search path is
// intentionally excluded by default because each uncached call costs OpenAI
// tokens; enable the `ai` scenario below deliberately if you want to load it.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:4000";

export const options = {
  scenarios: {
    catalog: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "15s", target: 20 },
        { duration: "30s", target: 20 },
        { duration: "15s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<800"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const health = http.get(`${BASE}/health`);
  check(health, { "health 200": (r) => r.status === 200 });

  const list = http.get(`${BASE}/api/products?limit=10&maxPrice=150`);
  check(list, {
    "products 200": (r) => r.status === 200,
    "products payload": (r) => Array.isArray(r.json("data")),
  });

  const single = http.get(`${BASE}/api/recommendations/similar/000000000000000000000000`);
  check(single, { "similar handled": (r) => r.status === 200 || r.status === 404 });

  sleep(1);
}
