import assert from "node:assert/strict";
import test from "node:test";

import { reminderTemplateEmailTestPerMinuteRateLimiter } from "./rateLimit.middleware.js";

function runMiddleware(middleware, req) {
  return new Promise((resolve, reject) => {
    const result = {
      body: null,
      nextCalled: false,
      statusCode: 200,
    };

    const res = {
      status(code) {
        result.statusCode = code;
        return this;
      },
      json(payload) {
        result.body = payload;
        resolve(result);
        return this;
      },
      setHeader() {},
    };

    middleware(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }

      result.nextCalled = true;
      resolve(result);
    });
  });
}

function buildRequest(userId) {
  return {
    app: {
      get() {
        return false;
      },
      set() {},
    },
    headers: {},
    ip: "127.0.0.1",
    method: "POST",
    originalUrl: "/api/reminder-templates/email-test",
    path: "/api/reminder-templates/email-test",
    rateLimit: null,
    user: {
      id: userId,
    },
  };
}

test("rate limit de envio de teste bloqueia abuso por usuário", async () => {
  for (let index = 0; index < 5; index += 1) {
    const result = await runMiddleware(
      reminderTemplateEmailTestPerMinuteRateLimiter,
      buildRequest("admin-rate-limit"),
    );

    assert.equal(result.nextCalled, true);
    assert.equal(result.statusCode, 200);
  }

  const blockedResult = await runMiddleware(
    reminderTemplateEmailTestPerMinuteRateLimiter,
    buildRequest("admin-rate-limit"),
  );

  assert.equal(blockedResult.statusCode, 429);
  assert.equal(blockedResult.body.code, "EMAIL_TEMPLATE_TEST_RATE_LIMIT");
});
