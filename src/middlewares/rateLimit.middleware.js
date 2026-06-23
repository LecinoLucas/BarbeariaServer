import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

function resolveNumber(value, fallback) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildRateLimitHandler(code, message) {
  return (req, res) => {
    res.status(429).json({
      success: false,
      code,
      message,
      retryAfter: req.rateLimit?.resetTime ?? null,
    });
  };
}

function buildUserScopedRateLimiter({ windowMs, max, code, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator(req) {
      const userId = req.user?.id;
      return userId ? `user:${userId}` : req.ip;
    },
    handler: buildRateLimitHandler(code, message),
  });
}

export const apiRateLimiter = rateLimit({
  windowMs: resolveNumber(process.env.API_RATE_LIMIT_WINDOW_MS, 60 * 1000),
  max: resolveNumber(
    env.isProd ? process.env.API_RATE_LIMIT_MAX_PROD : process.env.API_RATE_LIMIT_MAX_DEV,
    env.isProd ? 300 : 3000,
  ),
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler(
    "RATE_LIMIT_EXCEEDED",
    "Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.",
  ),
});

export const loginRateLimiter = rateLimit({
  windowMs: resolveNumber(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: resolveNumber(
    env.isProd ? process.env.LOGIN_RATE_LIMIT_MAX_PROD : process.env.LOGIN_RATE_LIMIT_MAX_DEV,
    env.isProd ? 10 : 100,
  ),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: buildRateLimitHandler(
    "TOO_MANY_LOGIN_ATTEMPTS",
    "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
  ),
});

export const reminderTemplateEmailTestPerMinuteRateLimiter =
  buildUserScopedRateLimiter({
    windowMs: 60 * 1000,
    max: 5,
    code: "EMAIL_TEMPLATE_TEST_RATE_LIMIT",
    message: "Limite de envios de teste excedido. Aguarde um minuto e tente novamente.",
  });

export const reminderTemplateEmailTestPerHourRateLimiter =
  buildUserScopedRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 20,
    code: "EMAIL_TEMPLATE_TEST_RATE_LIMIT",
    message: "Limite de envios de teste excedido. Aguarde um pouco antes de tentar novamente.",
  });
