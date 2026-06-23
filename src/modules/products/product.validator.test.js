import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../errors/ValidationError.js";
import { validateCreateProduct, validateListProductsQuery } from "./product.validator.js";

test("validateCreateProduct aceita preço em centavos e normaliza textos opcionais", () => {
  const product = validateCreateProduct({ name: "Pomada modeladora", priceCents: 3500, sku: "", barcode: "", description: "" });
  assert.equal(product.priceCents, 3500);
  assert.equal(product.sku, null);
  assert.equal(product.description, null);
});

test("validateCreateProduct rejeita preço não inteiro, zero ou negativo", () => {
  for (const priceCents of [0, -1, 35.5]) {
    assert.throws(() => validateCreateProduct({ name: "Produto", priceCents }), ValidationError);
  }
});

test("validateListProductsQuery aplica paginação segura", () => {
  assert.deepEqual(validateListProductsQuery({ search: "  pomada  ", page: "2", limit: "20" }), { search: "pomada", page: 2, limit: 20 });
});
