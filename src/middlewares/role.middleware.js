import { ROLE_VALUES } from "../constants/roles.js";
import { ForbiddenError } from "../errors/ForbiddenError.js";
import { UnauthorizedError } from "../errors/UnauthorizedError.js";

export function authorizeRoles(...roles) {
  const allowedRoles = roles.filter((role) => ROLE_VALUES.includes(role));

  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError("Não autorizado."));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError("Acesso negado."));
    }

    return next();
  };
}
