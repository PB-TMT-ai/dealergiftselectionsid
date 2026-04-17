import { getServerSupabase } from "@/lib/supabase-server";
import { buildSummaries } from "@/lib/summary";
import { AdminView } from "@components/AdminView";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
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
  return <AdminView payload={payload} />;
}
