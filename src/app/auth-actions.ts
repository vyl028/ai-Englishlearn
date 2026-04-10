"use server";

import { cookies } from "next/headers";

const TOKEN_KEY = "lexi-auth-token";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 天

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_KEY, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_KEY);
}

export async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_KEY)?.value;
  return token || null;
}
