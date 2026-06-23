import assert from "node:assert/strict";
import test from "node:test";

import { corsOptions } from "./cors.js";

function resolveOrigin(origin) {
  return new Promise((resolve, reject) => {
    corsOptions.origin(origin, (error, allowed) => {
      if (error) reject(error);
      else resolve(allowed);
    });
  });
}

test("CORS aceita as portas de desenvolvimento 5173 e 5174", async () => {
  assert.equal(await resolveOrigin("http://localhost:5173"), true);
  assert.equal(await resolveOrigin("http://127.0.0.1:5173"), true);
  assert.equal(await resolveOrigin("http://localhost:5174"), true);
  assert.equal(await resolveOrigin("http://127.0.0.1:5174"), true);
});

test("CORS não libera origem arbitrária com credentials", async () => {
  assert.equal(await resolveOrigin("http://malicious.example"), false);
});
