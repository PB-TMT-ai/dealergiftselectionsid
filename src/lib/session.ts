import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "crypto";
import type { Role, SessionUser } from "@/types/domain";
import { ROLES } from "@/lib/constants";

const COOKIE_NAME = "dgsd_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days — survives browser refresh / reopen

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
  };
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET missing or too short (need 32+ chars). See .env.example.");
  }
  return s;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str: string): Buffer {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(payload: string): string {
  return b64urlEncode(createHmac("sha256", secret()).update(payload).digest());
}

export function encodeSession(user: SessionUser): string {
  const payload = b64urlEncode(Buffer.from(JSON.stringify(user)));
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(b64urlDecode(payload).toString("utf8")) as SessionUser;
    if (!obj.userId || !obj.name || !ROLES.includes(obj.role)) return null;
    return obj;
  } catch {
    return null;
  }
}

// Set cookies directly on the outgoing NextResponse — `cookies().set()` inside
// a Route Handler can drop the Set-Cookie header on some Next 14 runtimes.
export function setSessionCookieOnResponse(res: NextResponse, user: SessionUser) {
  res.cookies.set(COOKIE_NAME, encodeSession(user), cookieOptions(MAX_AGE));
}

export function clearSessionCookieOnResponse(res: NextResponse) {
  res.cookies.set(COOKIE_NAME, "", { ...cookieOptions(0), expires: new Date(0) });
}

export function getSession(): SessionUser | null {
  return decodeSession(cookies().get(COOKIE_NAME)?.value);
}

export function requireSession(): SessionUser {
  const s = getSession();
  if (!s) redirect("/");
  return s;
}

export function requireRole(allowed: Role | Role[]): SessionUser {
  const s = requireSession();
  const list = Array.isArray(allowed) ? allowed : [allowed];
  if (!list.includes(s.role)) {
    // SM/TM trying to access admin → push back to their dashboard
    redirect(s.role === "sm_tm" ? "/dashboard" : "/");
  }
  return s;
}
