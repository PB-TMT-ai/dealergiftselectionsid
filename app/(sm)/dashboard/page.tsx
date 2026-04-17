import { getServerSupabase } from "@/lib/supabase-server";
import { RetailerBrowser } from "@components/RetailerBrowser";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = getServerSupabase();

  // One fetch → the browser derives zone/state/distributor cascading options.
  const { data } = await supabase
    .from("retailers")
    .select("zone, state_name, distributor_name")
    .gt("earned_points", 0);

  const rows = (data ?? []).map((r) => ({
    zone: r.zone ?? null,
    state: r.state_name ?? null,
    distributor: r.distributor_name ?? null,
  }));

  return <RetailerBrowser filterSource={rows} />;
}
