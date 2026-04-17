import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { requireSession } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: { sfId: string } }) {
  requireSession();
  const supabase = getServerSupabase();

  const [retailerRes, selectionsRes, catalogRes] = await Promise.all([
    supabase.from("retailers").select("*").eq("sf_id", params.sfId).maybeSingle(),
    supabase
      .from("gift_selections")
      .select("id, gift_id, points_used, quantity, notes, selected_by, gift:gifts_catalog(*)")
      .eq("retailer_sf_id", params.sfId),
    supabase.from("gifts_catalog").select("*").order("is_flexible", { ascending: true }).order("points_required", { ascending: true }),
  ]);

  if (retailerRes.error)   return NextResponse.json({ error: retailerRes.error.message }, { status: 500 });
  if (!retailerRes.data)   return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (selectionsRes.error) return NextResponse.json({ error: selectionsRes.error.message }, { status: 500 });
  if (catalogRes.error)    return NextResponse.json({ error: catalogRes.error.message }, { status: 500 });

  return NextResponse.json({
    retailer: retailerRes.data,
    selections: selectionsRes.data ?? [],
    catalog: catalogRes.data ?? [],
  });
}
