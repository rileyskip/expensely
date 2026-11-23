import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url');
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${derived.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const [algorithm, salt, encoded] = String(stored || '').split('$');
  if (algorithm !== 'scrypt' || !salt || !encoded) return false;
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(encoded, 'base64url');
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

export function newToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}
