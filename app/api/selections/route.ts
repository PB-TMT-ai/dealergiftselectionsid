import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase-server";
import { getSession, setSessionCookieOnResponse } from "@/lib/session";
import { VOUCHER_MIN_POINTS } from "@/lib/constants";

const Body = z.object({
  sfId: z.string().min(1),
  selections: z.array(
    z.object({
      gift_id: z.string().uuid(),
      points_used: z.number().int().positive(),
      quantity: z.number().int().positive().default(1),
      notes: z.string().optional().nullable(),
    })
  ),
});

export async function POST(req: Request) {
  const user = getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { sfId, selections } = parsed.data;

  const supabase = getServerSupabase();

  // Fetch retailer earned points + voucher id for a frontline validation pass
  // (the RPC and trigger are the real enforcement, but this gives nicer errors).
  const [retRes, voucherRes] = await Promise.all([
    supabase.from("retailers").select("earned_points").eq("sf_id", sfId).maybeSingle(),
    supabase.from("gifts_catalog").select("id").eq("is_flexible", true).maybeSingle(),
  ]);
  if (retRes.error || !retRes.data) {
    return NextResponse.json({ error: "Retailer not found" }, { status: 404 });
  }
  const earned = retRes.data.earned_points;
  const voucherId = voucherRes.data?.id;
  const total = selections.reduce((s, x) => s + x.points_used, 0);
  if (total > earned) {
    return NextResponse.json(
      { error: `Total redeemed (${total}) exceeds earned points (${earned})` },
      { status: 400 }
    );
  }
  for (const s of selections) {
    if (s.gift_id === voucherId && s.points_used < VOUCHER_MIN_POINTS) {
      return NextResponse.json(
        { error: `Voucher minimum is ${VOUCHER_MIN_POINTS} points` },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase.rpc("replace_selections", {
    p_retailer: sfId,
    p_selections: selections,
    p_user: user.name,
  });
  if (error) {
    // Surface RPC error message cleanly.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  setSessionCookieOnResponse(res, user);
  return res;
}
