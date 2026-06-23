import { z } from "zod";

import { ValidationError } from "../../errors/ValidationError.js";
import { PRODUCT_STATUS } from "../../constants/productStatus.js";

const statusSchema = z.enum(Object.values(PRODUCT_STATUS), {
  errorMap: () => ({ message: "Status inválido." }),
});

function optionalText(value) {
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}

const optionalString = (max, label) => z.preprocess(
  optionalText,
  z.string().trim().max(max, `${label} deve ter no máximo ${max} caracteres.`).optional(),
).transform((value) => value ?? null);

const productFields = {
  name: z.string({ required_error: "Nome é obrigatório." }).trim().min(2, "Nome deve ter no mínimo 2 caracteres.").max(120, "Nome deve ter no máximo 120 caracteres."),
  description: optionalString(500, "Descrição"),
  sku: optionalString(80, "SKU"),
  barcode: optionalString(80, "Código de barras"),
  priceCents: z.coerce.number({ required_error: "Preço é obrigatório." }).int("Preço deve ser informado em centavos inteiros.").positive("Preço deve ser maior que zero.").max(100000000, "Preço inválido."),
  costCents: z.preprocess(optionalText, z.coerce.number().int("Custo deve ser informado em centavos inteiros.").min(0, "Custo não pode ser negativo.").max(100000000, "Custo inválido.").optional()).transform((value) => value ?? null),
  status: statusSchema.default(PRODUCT_STATUS.ACTIVE),
};

const createProductSchema = z.object(productFields);
const updateProductSchema = z.object({ ...productFields, status: statusSchema });
const updateStatusSchema = z.object({ status: statusSchema });
const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional().transform((value) => value || undefined),
  status: statusSchema.optional(),
});

function parseOrThrow(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) throw new ValidationError(result.error);
  return result.data;
}

export const validateCreateProduct = (payload) => parseOrThrow(createProductSchema, payload);
export const validateUpdateProduct = (payload) => parseOrThrow(updateProductSchema, payload);
export const validateUpdateProductStatus = (payload) => parseOrThrow(updateStatusSchema, payload);
export const validateListProductsQuery = (payload) => parseOrThrow(listProductsQuerySchema, payload);
