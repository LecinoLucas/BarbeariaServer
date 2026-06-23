import { env } from "../../config/env.js";
import { successResponse } from "../../utils/response.js";
import { login as loginService, refresh as refreshService } from "./auth.service.js";
import { validateLogin } from "./auth.validator.js";

const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function getRefreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  };
}

export async function login(req, res, next) {
  try {
    const data = validateLogin(req.body);
    const result = await loginService(data);

    res.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      result.refreshToken,
      getRefreshTokenCookieOptions(),
    );

    return successResponse(
      res,
      { accessToken: result.accessToken, user: result.user },
      "Login realizado com sucesso.",
    );
  } catch (error) {
    return next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const result = await refreshService(req.cookies?.refreshToken);

    return successResponse(
      res,
      { accessToken: result.accessToken, user: result.user },
      "Token renovado com sucesso.",
    );
  } catch (error) {
    return next(error);
  }
}

export function logout(req, res) {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "strict",
    path: "/api/auth",
  });

  return successResponse(res, null, "Logout realizado com sucesso.");
}

export function me(req, res) {
  return successResponse(res, { user: req.user }, "Usuário autenticado retornado com sucesso.");
}
