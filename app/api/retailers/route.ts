import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { getSession, setSessionCookieOnResponse } from "@/lib/session";

export async function GET(req: Request) {
  const user = getSession();
  if (!user) {
    // 401 (not redirect) so client fetch() doesn't silently follow to login HTML
    // and stall the grid. RetailerBrowser handles 401 by routing to /.
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = new URL(req.url).searchParams;

  const distributor = sp.get("distributor") ?? null;
  const state       = sp.get("state") ?? null;
  const zone        = sp.get("zone") ?? null;
  const name        = sp.get("name")?.trim() ?? null;
  const hasSel      = sp.get("hasSelections"); // "true" | "false" | null
  const limit       = Math.min(Number(sp.get("limit") ?? 50), 200);
  const offset      = Math.max(Number(sp.get("offset") ?? 0), 0);

  const supabase = getServerSupabase();

  // Read from the `retailers_with_summary` view (migration 0002) so the
  // "has selections" filter, points_used, balance, and gifts_summary come
  // straight from SQL — no extra nested join, no client-side post-filtering,
  // correct count.
  let q = supabase
    .from("retailers_with_summary")
    .select(
      "sf_id, retailer_name, distributor_name, state_name, district_name, zone, distributor_self_counter, q4_volume, earned_points, eligible_slab, max_eligible_gift, points_used, balance, selection_count, gifts_summary",
      { count: "exact" }
    )
    .gt("earned_points", 0)
    .order("retailer_name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (distributor)        q = q.eq("distributor_name", distributor);
  if (state)              q = q.eq("state_name", state);
  if (zone)               q = q.eq("zone", zone);
  if (name)               q = q.ilike("retailer_name", `%${name}%`);
  if (hasSel === "true")  q = q.gt("selection_count", 0);
  if (hasSel === "false") q = q.eq("selection_count", 0);

  const { data, error, count } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const res = NextResponse.json({
    rows: data ?? [],
    total: count ?? (data?.length ?? 0),
    limit,
    offset,
  });
  // Sliding expiry: each authenticated request extends the session.
  setSessionCookieOnResponse(res, user);
  return res;
}
