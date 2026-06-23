import { ROLES } from "../../constants/roles.js";
import { PRODUCT_STATUS } from "../../constants/productStatus.js";
import { ConflictError } from "../../errors/ConflictError.js";
import { NotFoundError } from "../../errors/NotFoundError.js";
import { count, create, findById, findBySku, list, update } from "./product.repository.js";

const NOT_FOUND = "Produto não encontrado.";

function serialize(product, actor) {
  if (!product) return product;
  if (actor?.role === ROLES.ADMIN) return product;
  const { costCents, ...safeProduct } = product;
  return safeProduct;
}

async function ensureSkuAvailable(sku, excludingId) {
  if (!sku) return;
  if (await findBySku(sku, excludingId)) {
    throw new ConflictError("Já existe um produto com este SKU.");
  }
}

export async function createProduct(payload, actor) {
  await ensureSkuAvailable(payload.sku);
  return serialize(await create(payload), actor);
}

export async function listProducts(query, actor) {
  const filters = actor.role === ROLES.PROFESSIONAL
    ? { ...query, status: PRODUCT_STATUS.ACTIVE }
    : query;
  const [items, total] = await Promise.all([list(filters), count(filters)]);
  return {
    items: items.map((product) => serialize(product, actor)),
    meta: { page: filters.page, limit: filters.limit, total, totalPages: total ? Math.ceil(total / filters.limit) : 0 },
  };
}

export async function getProductById(id, actor) {
  const product = await findById(id);
  if (!product || (actor.role === ROLES.PROFESSIONAL && product.status !== PRODUCT_STATUS.ACTIVE)) {
    throw new NotFoundError(NOT_FOUND);
  }
  return serialize(product, actor);
}

export async function updateProduct(id, payload, actor) {
  if (!await findById(id)) throw new NotFoundError(NOT_FOUND);
  await ensureSkuAvailable(payload.sku, id);
  return serialize(await update(id, payload), actor);
}

export async function updateProductStatus(id, payload, actor) {
  if (!await findById(id)) throw new NotFoundError(NOT_FOUND);
  return serialize(await update(id, { status: payload.status }), actor);
}
