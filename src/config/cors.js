import { env } from "./env.js";

function isAllowedDevelopmentOrigin(origin) {
  return /^http:\/\/(localhost|127\.0\.0\.1):(5173|5174)$/.test(origin);
}

export const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    const allowed = env.ALLOWED_ORIGINS.includes(origin)
      || (env.isDev && isAllowedDevelopmentOrigin(origin));

    return callback(null, allowed);
  },
  credentials: true,
};
