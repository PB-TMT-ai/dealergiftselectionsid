import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase-server";
import { setSessionCookieOnResponse } from "@/lib/session";
import { ROLES } from "@/lib/constants";
import type { Role } from "@/types/domain";

const Body = z.object({ pin: z.string().min(4).max(6) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid PIN" }, { status: 400 });

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, name, role")
    .eq("pin", parsed.data.pin)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Server error" }, { status: 500 });
  if (!data || !ROLES.includes(data.role as Role)) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, role: data.role, name: data.name });
  setSessionCookieOnResponse(res, { userId: data.id, name: data.name, role: data.role as Role });
  return res;
}
