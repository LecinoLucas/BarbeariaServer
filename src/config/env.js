import "dotenv/config";

const REQUIRED_ENV_KEYS = [
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "CLIENT_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
];

const VALID_NODE_ENVS = new Set(["development", "test", "production"]);
const INSECURE_SECRET_MARKER = "change_me";

function getEnvValue(key) {
  const value = process.env[key];

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getBooleanEnvValue(key, fallback = false) {
  const value = getEnvValue(key).toLowerCase();

  if (!value) {
    return fallback;
  }

  return value === "true";
}

const missing = REQUIRED_ENV_KEYS.filter((key) => !getEnvValue(key));

if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

const nodeEnv = getEnvValue("NODE_ENV");

if (!VALID_NODE_ENVS.has(nodeEnv)) {
  throw new Error(
    `NODE_ENV inválido: ${nodeEnv}. Use development, test ou production.`,
  );
}

const port = Number(getEnvValue("PORT"));

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT deve ser um número inteiro maior que zero.");
}

function ensureSecureSecret(key) {
  const value = getEnvValue(key);

  if (value.toLowerCase().includes(INSECURE_SECRET_MARKER)) {
    throw new Error(
      `${key} não pode usar valor inseguro em produção. Defina um secret real.`,
    );
  }
}

if (nodeEnv === "production") {
  ensureSecureSecret("JWT_ACCESS_SECRET");
  ensureSecureSecret("JWT_REFRESH_SECRET");
}

export const env = {
  NODE_ENV: nodeEnv,
  PORT: port,
  DATABASE_URL: getEnvValue("DATABASE_URL"),
  CLIENT_URL: getEnvValue("CLIENT_URL"),
  EMAIL_PROVIDER: getEnvValue("EMAIL_PROVIDER") || "resend",
  EMAIL_ENABLED: getBooleanEnvValue("EMAIL_ENABLED", false),
  RESEND_API_KEY: getEnvValue("RESEND_API_KEY"),
  EMAIL_FROM: getEnvValue("EMAIL_FROM"),
  EMAIL_REPLY_TO: getEnvValue("EMAIL_REPLY_TO"),
  APP_PUBLIC_URL: getEnvValue("APP_PUBLIC_URL") || getEnvValue("CLIENT_URL"),
  JWT_ACCESS_SECRET: getEnvValue("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: getEnvValue("JWT_REFRESH_SECRET"),
  JWT_ACCESS_EXPIRES_IN: getEnvValue("JWT_ACCESS_EXPIRES_IN") || "15m",
  JWT_REFRESH_EXPIRES_IN: getEnvValue("JWT_REFRESH_EXPIRES_IN") || "7d",
  isDev: nodeEnv === "development",
  isProd: nodeEnv === "production",
};
