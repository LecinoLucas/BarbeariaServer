import { env } from "../../config/env.js";
import { successResponse } from "../../utils/response.js";
import {
  changePassword as changePasswordService,
  login as loginService,
  me as meService,
  refresh as refreshService,
} from "./clientAuth.service.js";
import {
  validateClientAuthLogin,
  validateClientAuthPassword,
} from "./clientAuth.validator.js";

export const CLIENT_REFRESH_TOKEN_COOKIE_NAME = "clientRefreshToken";
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

export function getClientRefreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "strict",
    path: "/api/client-auth",
    maxAge: REFRESH_TOKEN_MAX_AGE,
  };
}

export function createClientAuthController(deps = {}) {
  const service = {
    login: loginService,
    refresh: refreshService,
    me: meService,
    changePassword: changePasswordService,
    ...deps,
  };

  return {
    async login(req, res, next) {
      try {
        const data = validateClientAuthLogin(req.body);
        const result = await service.login(data);

        res.cookie(
          CLIENT_REFRESH_TOKEN_COOKIE_NAME,
          result.refreshToken,
          getClientRefreshTokenCookieOptions(),
        );

        return successResponse(
          res,
          {
            accessToken: result.accessToken,
            user: result.user,
            client: result.client,
          },
          "Login do cliente realizado com sucesso.",
        );
      } catch (error) {
        return next(error);
      }
    },

    async refresh(req, res, next) {
      try {
        const result = await service.refresh(req.cookies?.clientRefreshToken);

        return successResponse(
          res,
          {
            accessToken: result.accessToken,
            user: result.user,
            client: result.client,
          },
          "Token do cliente renovado com sucesso.",
        );
      } catch (error) {
        return next(error);
      }
    },

    logout(req, res) {
      res.clearCookie(CLIENT_REFRESH_TOKEN_COOKIE_NAME, {
        httpOnly: true,
        secure: env.isProd,
        sameSite: "strict",
        path: "/api/client-auth",
      });

      return successResponse(res, null, "Logout do cliente realizado com sucesso.");
    },

    async me(req, res, next) {
      try {
        const data = await service.me(req.user.id);
        return successResponse(res, data, "Cliente autenticado retornado com sucesso.");
      } catch (error) {
        return next(error);
      }
    },

    async changePassword(req, res, next) {
      try {
        const data = validateClientAuthPassword(req.body);
        await service.changePassword(req.user.id, data);
        return successResponse(res, null, "Senha do cliente atualizada com sucesso.");
      } catch (error) {
        return next(error);
      }
    },
  };
}

const defaultController = createClientAuthController();

export const login = defaultController.login;
export const refresh = defaultController.refresh;
export const logout = defaultController.logout;
export const me = defaultController.me;
export const changePassword = defaultController.changePassword;
