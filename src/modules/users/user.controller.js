import { successResponse } from "../../utils/response.js";
import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  updateUser,
  updateUserPassword,
  updateUserStatus,
} from "./user.service.js";
import {
  validateCreateUser,
  validateListUsersQuery,
  validateUpdateUser,
  validateUpdateUserPassword,
  validateUpdateUserStatus,
} from "./user.validator.js";


export async function createUserHandler(req, res, next) {
  try {
    const data = validateCreateUser(req.body);
    const user = await createUser(data);

    return successResponse(res, user, "Usuário criado com sucesso.", 201);
  } catch (error) {
    return next(error);
  }
}

export async function listUsersHandler(req, res, next) {
  try {
    const query = validateListUsersQuery(req.query);
    const result = await listUsers(query);

    return successResponse(res, result, "Usuários listados com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function getUserByIdHandler(req, res, next) {
  try {
    const user = await getUserById(req.params.id);

    return successResponse(res, user, "Usuário encontrado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateUserHandler(req, res, next) {
  try {
    const data = validateUpdateUser(req.body);
    const user = await updateUser(req.params.id, data);

    return successResponse(res, user, "Usuário atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateUserPasswordHandler(req, res, next) {
  try {
    const data = validateUpdateUserPassword(req.body);
    await updateUserPassword(req.params.id, data);

    return successResponse(res, null, "Senha atualizada com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function updateUserStatusHandler(req, res, next) {
  try {
    const data = validateUpdateUserStatus(req.body);
    const user = await updateUserStatus(req.params.id, data);

    return successResponse(res, user, "Status do usuário atualizado com sucesso.");
  } catch (error) {
    return next(error);
  }
}

export async function deleteUserHandler(req, res, next) {
  try {
    await deleteUser(req.params.id);

    return successResponse(res, null, "Usuário removido com sucesso.");
  } catch (error) {
    return next(error);
  }
}
