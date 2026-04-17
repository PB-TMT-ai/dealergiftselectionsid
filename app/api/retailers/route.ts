import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { requireSession } from "@/lib/session";

export async function GET(req: Request) {
  requireSession();
  const sp = new URL(req.url).searchParams;

  const distributor = sp.get("distributor") ?? null;
  const state       = sp.get("state") ?? null;
  const zone        = sp.get("zone") ?? null;
  const name        = sp.get("name")?.trim() ?? null;
  const hasSel      = sp.get("hasSelections"); // "true" | "false" | null
  const limit       = Math.min(Number(sp.get("limit") ?? 50), 200);
  const offset      = Math.max(Number(sp.get("offset") ?? 0), 0);

  const supabase = getServerSupabase();

  let q = supabase
    .from("retailers")
    .select(
      "sf_id, retailer_name, distributor_name, state_name, district_name, zone, distributor_self_counter, q4_volume, earned_points, eligible_slab, max_eligible_gift, gift_selections(points_used, quantity, gift:gifts_catalog(name))",
      { count: "exact" }
    )
    .gt("earned_points", 0) // only retailers with earned points
    .order("retailer_name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (distributor) q = q.eq("distributor_name", distributor);
  if (state)       q = q.eq("state_name", state);
  if (zone)        q = q.eq("zone", zone);
  if (name)        q = q.ilike("retailer_name", `%${name}%`);

  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // has-selections filter applied in app layer (simpler than SQL-side join filter).
  let rows = data ?? [];
  if (hasSel === "true")  rows = rows.filter((r) => (r as any).gift_selections?.length > 0);
  if (hasSel === "false") rows = rows.filter((r) => !((r as any).gift_selections?.length > 0));

  return NextResponse.json({
    rows: rows.map(shape),
    total: count ?? rows.length,
    limit,
    offset,
  });
}

function shape(r: any) {
  const sels = (r.gift_selections ?? []) as Array<{ points_used: number; quantity: number; gift: { name: string } | null }>;
  const pointsUsed = sels.reduce((s, x) => s + (x.points_used ?? 0), 0);
  return {
    ...r,
    points_used: pointsUsed,
    balance: (r.earned_points ?? 0) - pointsUsed,
    gifts_summary: sels
      .filter((x) => x.gift?.name)
      .map((x) => (x.quantity > 1 ? `${x.quantity}× ${x.gift!.name}` : x.gift!.name))
      .join(", "),
    gift_selections: undefined,
  };
}
