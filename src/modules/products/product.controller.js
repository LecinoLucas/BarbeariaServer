import { successResponse } from "../../utils/response.js";
import { createProduct, getProductById, listProducts, updateProduct, updateProductStatus } from "./product.service.js";
import { validateCreateProduct, validateListProductsQuery, validateUpdateProduct, validateUpdateProductStatus } from "./product.validator.js";

export async function createProductHandler(req, res, next) {
  try { return successResponse(res, await createProduct(validateCreateProduct(req.body), req.user), "Produto criado com sucesso.", 201); } catch (error) { return next(error); }
}
export async function listProductsHandler(req, res, next) {
  try { return successResponse(res, await listProducts(validateListProductsQuery(req.query), req.user), "Produtos listados com sucesso."); } catch (error) { return next(error); }
}
export async function getProductByIdHandler(req, res, next) {
  try { return successResponse(res, await getProductById(req.params.id, req.user), "Produto encontrado com sucesso."); } catch (error) { return next(error); }
}
export async function updateProductHandler(req, res, next) {
  try { return successResponse(res, await updateProduct(req.params.id, validateUpdateProduct(req.body), req.user), "Produto atualizado com sucesso."); } catch (error) { return next(error); }
}
export async function updateProductStatusHandler(req, res, next) {
  try { return successResponse(res, await updateProductStatus(req.params.id, validateUpdateProductStatus(req.body), req.user), "Status do produto atualizado com sucesso."); } catch (error) { return next(error); }
}
