import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

export async function GET() {
  clearSessionCookie();
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"));
}

export async function POST() {
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
