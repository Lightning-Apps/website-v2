// Password login for running the dashboard on a server.
// Locally (`npm run dashboard` on 127.0.0.1) no login is needed unless a password hash is set.
import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';
import { DASHBOARD_PASSWORD_HASH, DASHBOARD_SESSION_SECRET } from 'astro:env/server';

export const SESSION_COOKIE = 'la_dashboard_session';
const SESSION_DAYS = 14;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

/** True when the dashboard requires a login. Production builds always do. */
export function authRequired(): boolean {
  return Boolean(DASHBOARD_PASSWORD_HASH) || !import.meta.env.DEV;
}

/** Problem with the login configuration, if any (shown instead of the login form). */
export function authConfigError(): string | null {
  if (!authRequired()) return null;
  if (!DASHBOARD_PASSWORD_HASH) return 'DASHBOARD_PASSWORD_HASH fehlt in der .env des Servers.';
  if (!DASHBOARD_PASSWORD_HASH.startsWith('scrypt:') || DASHBOARD_PASSWORD_HASH.split(':').length !== 3)
    return 'DASHBOARD_PASSWORD_HASH hat ein unbekanntes Format. Neu erzeugen mit: npm run hash-password -w dashboard';
  if (!DASHBOARD_SESSION_SECRET || DASHBOARD_SESSION_SECRET.length < 32)
    return 'DASHBOARD_SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen.';
  return null;
}

/** Hash format (see scripts/hash-password.mjs): scrypt:<salt base64url>:<key base64url>. */
function verifyPassword(password: string): boolean {
  const [, salt, expected] = (DASHBOARD_PASSWORD_HASH ?? '').split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, Buffer.from(salt, 'base64url'), 64);
  const wanted = Buffer.from(expected, 'base64url');
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

function sign(value: string): string {
  return createHmac('sha256', DASHBOARD_SESSION_SECRET!).update(value).digest('base64url');
}

export function createSession(): { value: string; maxAge: number } {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const expires = String(Date.now() + maxAge * 1000);
  return { value: `${expires}.${sign(expires)}`, maxAge };
}

export function isValidSession(cookie: string | undefined): boolean {
  if (!cookie || authConfigError()) return false;
  const [expires, signature] = cookie.split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(expires));
  return a.length === b.length && timingSafeEqual(a, b);
}

/* Brute-force protection, per client address (in memory, resets on restart). */
const failures = new Map<string, { count: number; lockedUntil: number }>();

export function lockedMinutes(client: string): number {
  const entry = failures.get(client);
  if (!entry || entry.lockedUntil < Date.now()) return 0;
  return Math.ceil((entry.lockedUntil - Date.now()) / 60_000);
}

export function attemptLogin(client: string, password: string): boolean {
  if (lockedMinutes(client) > 0) return false;
  if (verifyPassword(password)) {
    failures.delete(client);
    return true;
  }
  const entry = failures.get(client) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_FAILURES) {
    entry.count = 0;
    entry.lockedUntil = Date.now() + LOCK_MINUTES * 60_000;
  }
  failures.set(client, entry);
  return false;
}
