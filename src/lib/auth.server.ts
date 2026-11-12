import { useSession } from "@tanstack/react-start/server";

export async function safeEqual(input: string, expected: string) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(input)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

type AccountSession = { userId?: string; aiDenied?: string };

export function getAccountSession() {
  return useSession<AccountSession>({
    password: process.env["SESSION_SECRET"]!,
    name: "perk-account",
    maxAge: 60 * 60 * 12,
    cookie: { httpOnly: true, secure: true, sameSite: "none", path: "/" },
  });
}

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

function pinSecret() {
  const secret = process.env["SESSION_SECRET"];
  // Never fall back to a built-in value: a missing secret must stop PIN checks, not weaken them.
  if (!secret || secret.length < 16) throw new Error("Server is not configured");
  return secret;
}

/**
 * Current PIN hash: PBKDF2-SHA256 (100,000 rounds, the most Cloudflare Workers allow) with a per-user salt and a
 * server-only secret, so a copied hash cannot be guessed offline without the secret. The raw PIN is never stored.
 */
export async function pinHash(userId: string, pin: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", iterations: 100_000, salt: enc.encode(`${pinSecret()}:${userId}`) }, key, 256);
  return `v2$${hex(bits)}`;
}

/** The first format (one SHA-256 round). Only used to recognise an old PIN once so it can be upgraded. */
async function legacyPinHash(userId: string, pin: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${pinSecret()}:${userId}:${pin}`));
  return hex(digest);
}

/** Checks a PIN against the stored hash. `upgrade` is true when the stored hash is the old format and should be rewritten. */
export async function verifyPin(userId: string, pin: string, stored: string) {
  if (stored.startsWith("v2$")) return { ok: await safeEqual(await pinHash(userId, pin), stored), upgrade: false };
  return { ok: await safeEqual(await legacyPinHash(userId, pin), stored), upgrade: true };
}

/** Every account-data server function must pass this gate after auth. */
export async function requireUnlocked(userId: string) {
  const session = await getAccountSession();
  if (session.data.userId !== userId) throw new Error("Unlock your account with your PIN first");
}
