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

export async function checkAdminPassword(input: string) {
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected) throw new Error("Admin password is not set");
  if (!(await safeEqual(input, expected))) throw new Error("Wrong password");
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

/** Salted, per-user PIN hash — the raw PIN is never stored. */
export async function pinHash(userId: string, pin: string) {
  const secret = process.env["SESSION_SECRET"] ?? "perk-dev";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${secret}:${userId}:${pin}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Every account-data server function must pass this gate after auth. */
export async function requireUnlocked(userId: string) {
  const session = await getAccountSession();
  if (session.data.userId !== userId) throw new Error("Unlock your account with your PIN first");
}

/** Demo card details, generated per user at setup. */
export function generateCard() {
  const digits = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b % 10).join("");
  const number = `4539 ${digits(4)} ${digits(4)} ${digits(4)}`;
  const month = String(((crypto.getRandomValues(new Uint8Array(1))[0] ?? 0) % 12) + 1).padStart(2, "0");
  const year = String((new Date().getFullYear() + 4) % 100).padStart(2, "0");
  return { card_number: number, expiry: `${month}/${year}`, cvc: digits(3), last4: number.slice(-4) };
}
