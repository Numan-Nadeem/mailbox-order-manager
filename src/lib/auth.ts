import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import type { Role, User } from "@prisma/client";

const COOKIE_NAME = "mom_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

/** The session token is a random value; only its hash is stored in the DB. */
export function hashToken(token: string): string {
  return createHash("sha256").update(`${sessionSecret()}:${token}`).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Create a session row and set the cookie. Returns the user. */
export async function signIn(email: string, password: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new Error("Invalid email or password");
  }
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      token: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === "production",
  });
  return user;
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token: hashToken(token) } });
  }
  store.delete(COOKIE_NAME);
}

/** Returns the signed-in user, or null. Never throws for a bad cookie. */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");
  return user;
}

export async function requireRole(role: Role): Promise<User> {
  const user = await requireUser();
  if (user.role !== role) throw new Error(`Requires role ${role}`);
  return user;
}
