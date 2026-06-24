import assert from "node:assert/strict";
import test from "node:test";

import { corpPublicAssets } from "./corpPublicAssets.middleware.js";

function createResponseDouble() {
  const headers = {};
  return {
    headers,
    setHeader(name, value) {
      headers[name] = value;
    },
  };
}

test("corpPublicAssets define Cross-Origin-Resource-Policy: cross-origin", () => {
  const res = createResponseDouble();
  let nextCalled = false;

  corpPublicAssets({}, res, () => {
    nextCalled = true;
  });

  assert.equal(
    res.headers["Cross-Origin-Resource-Policy"],
    "cross-origin",
    "Header ausente — imagens servidas pelo backend serão bloqueadas pelo browser quando o frontend está em outra porta",
  );
  assert.equal(nextCalled, true, "next() deve ser chamado para que express.static sirva o arquivo");
});

test("corpPublicAssets sempre chama next() independente do path", () => {
  const res = createResponseDouble();
  let nextCalled = false;

  corpPublicAssets({ path: "/qualquer-arquivo.jpg" }, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.headers["Cross-Origin-Resource-Policy"], "cross-origin");
});
