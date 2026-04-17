import { NextResponse } from "next/server";
import { clearSessionCookieOnResponse } from "@/lib/session";

export async function GET() {
  const res = NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
  );
  clearSessionCookieOnResponse(res);
  return res;
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookieOnResponse(res);
  return res;
}
