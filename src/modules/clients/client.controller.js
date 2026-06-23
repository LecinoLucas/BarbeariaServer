import { successResponse } from "../../utils/response.js";
import {
  createClient,
  deleteClient,
  getClientBirthdays,
  getClientById,
  getTopActiveClients,
  listClients,
  updateClient,
  updateClientStatus,
} from "./client.service.js";
import {
  validateBirthdaysQuery,
  validateCreateClient,
  validateListClientsQuery,
  validateTopActiveClientsQuery,
  validateUpdateClient,
  validateUpdateClientStatus,
} from "./client.validator.js";


export async function createClientHandler(req, res, next) {
  try {
    const data = validateCreateClient(req.body);
    const client = await createClient(data);

    return successResponse(res, client, "Cliente criado com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listClientsHandler(req, res, next) {
  try {
    const query = validateListClientsQuery(req.query);
    const result = await listClients(query);

    return successResponse(res, result, "Clientes listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getClientByIdHandler(req, res, next) {
  try {
    const client = await getClientById(req.params.id, req.user);

    return successResponse(res, client, "Cliente encontrado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateClientHandler(req, res, next) {
  try {
    const data = validateUpdateClient(req.body);
    const client = await updateClient(req.params.id, data, req.user);

    return successResponse(res, client, "Cliente atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateClientStatusHandler(req, res, next) {
  try {
    const data = validateUpdateClientStatus(req.body);
    const client = await updateClientStatus(req.params.id, data);

    return successResponse(res, client, "Status do cliente atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function deleteClientHandler(req, res, next) {
  try {
    await deleteClient(req.params.id);

    return successResponse(res, null, "Cliente removido com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function listBirthdaysByMonthHandler(req, res, next) {
  try {
    const data = validateBirthdaysQuery(req.query);
    const month = data.month ?? new Date().getMonth() + 1;
    const items = await getClientBirthdays(month);

    return successResponse(res, items, "Aniversariantes listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function listTopActiveClientsHandler(req, res, next) {
  try {
    const data = validateTopActiveClientsQuery(req.query);
    const items = await getTopActiveClients(data.limit);

    return successResponse(res, items, "Top clientes ativos listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}
