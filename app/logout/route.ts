import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookieOnResponse } from "@/lib/session";

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url));
  clearSessionCookieOnResponse(res);
  return res;
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookieOnResponse(res);
  return res;
}
