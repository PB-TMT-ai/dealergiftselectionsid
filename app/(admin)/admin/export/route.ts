import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";
import { requireRole } from "@/lib/session";
import { buildSummaries } from "@/lib/summary";
import { buildWorkbook } from "@/lib/export-xlsx";

export async function GET() {
  requireRole("admin");
  const supabase = getServerSupabase();
  const [retailers, selections, catalog] = await Promise.all([
    supabase.from("retailers").select("*").gt("earned_points", 0),
    supabase
      .from("gift_selections")
      .select("retailer_sf_id, gift_id, points_used, quantity, gift:gifts_catalog(id, name, is_flexible, gift_value_inr, points_required)"),
    supabase.from("gifts_catalog").select("*"),
  ]);
  const payload = buildSummaries(
    retailers.data ?? [],
    (selections.data ?? []) as any,
    catalog.data ?? []
  );
  const buf = buildWorkbook(payload);
  const today = new Date().toISOString().slice(0, 10);
  const body = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new NextResponse(body as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dealer-gift-scheme-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
