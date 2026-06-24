import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function comparePassword(password, hash) {
  if (typeof hash !== "string" || hash.length === 0) {
    return Promise.resolve(false);
  }

  return bcrypt.compare(password, hash);
}
