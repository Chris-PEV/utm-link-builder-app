import { Redis } from "@upstash/redis";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "utm-link-builder-secret-key-change-in-prod"
);

const COOKIE_NAME = "utm_session";

interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

// ── User Storage ──────────────────────────────────────────────────────

export async function createUser(
  name: string,
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists
  const existing = await redis.get(`user:${normalizedEmail}`);
  if (existing) {
    return { success: false, error: "An account with this email already exists" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user: User = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    password_hash: passwordHash,
    created_at: new Date().toISOString(),
  };

  await redis.set(`user:${normalizedEmail}`, JSON.stringify(user));
  return { success: true };
}

export async function verifyUser(
  email: string,
  password: string
): Promise<{ success: boolean; user?: Omit<User, "password_hash">; error?: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  const raw = await redis.get<string>(`user:${normalizedEmail}`);
  if (!raw) {
    return { success: false, error: "Invalid email or password" };
  }

  const user: User = typeof raw === "string" ? JSON.parse(raw) : raw;
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return { success: false, error: "Invalid email or password" };
  }

  const { password_hash, ...safeUser } = user;
  return { success: true, user: safeUser };
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const raw = await redis.get<string>(`user:${email.toLowerCase().trim()}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function updateUserPassword(
  email: string,
  newPassword: string
): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const raw = await redis.get<string>(`user:${normalizedEmail}`);
  if (!raw) return false;

  const user: User = typeof raw === "string" ? JSON.parse(raw) : raw;
  user.password_hash = await bcrypt.hash(newPassword, 10);
  await redis.set(`user:${normalizedEmail}`, JSON.stringify(user));
  return true;
}

// ── Reset Tokens ──────────────────────────────────────────────────────

export async function createResetToken(email: string): Promise<string | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  const token = crypto.randomUUID();
  // Store token with 1-hour expiry
  await redis.set(`reset:${token}`, email.toLowerCase().trim(), { ex: 3600 });
  return token;
}

export async function verifyResetToken(token: string): Promise<string | null> {
  const email = await redis.get<string>(`reset:${token}`);
  if (!email) return null;
  return email;
}

export async function consumeResetToken(token: string): Promise<void> {
  await redis.del(`reset:${token}`);
}

// ── JWT Sessions ──────────────────────────────────────────────────────

export async function createSession(userId: string, email: string, name: string) {
  const token = await new SignJWT({ userId, email, name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function getSession(): Promise<{
  userId: string;
  email: string;
  name: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: string; email: string; name: string };
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
