import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { requireRole } from "@/lib/session";
import { buildSummaries } from "@/lib/summary";

export async function GET() {
  requireRole("admin");
  const supabase = getServerSupabase();

  const [retailersRes, selectionsRes, catalogRes] = await Promise.all([
    supabase.from("retailers").select("*").gt("earned_points", 0),
    supabase
      .from("gift_selections")
      .select("retailer_sf_id, gift_id, points_used, quantity, gift:gifts_catalog(id, name, is_flexible, gift_value_inr, points_required)"),
    supabase.from("gifts_catalog").select("*"),
  ]);
  if (retailersRes.error)  return NextResponse.json({ error: retailersRes.error.message }, { status: 500 });
  if (selectionsRes.error) return NextResponse.json({ error: selectionsRes.error.message }, { status: 500 });
  if (catalogRes.error)    return NextResponse.json({ error: catalogRes.error.message }, { status: 500 });

  const payload = buildSummaries(retailersRes.data ?? [], selectionsRes.data ?? [], catalogRes.data ?? []);
  return NextResponse.json(payload);
}
