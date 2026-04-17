import { getServerSupabase } from "@/lib/supabase-server";
import { RetailerBrowser } from "@components/RetailerBrowser";

// 60-second ISR keeps back-navigation instant (and re-enables bfcache) while
// still picking up new retailers within a minute.
export const revalidate = 60;

export default async function DashboardPage() {
  const supabase = getServerSupabase();

  // Pulls already-unique (zone, state, distributor) tuples from the
  // `dashboard_filter_options` view (migration 0002_perf_indexes.sql) so the
  // client payload is kilobytes instead of tens of kilobytes.
  const { data } = await supabase
    .from("dashboard_filter_options")
    .select("zone, state_name, distributor_name");

  const rows = (data ?? []).map((r) => ({
    zone: r.zone ?? null,
    state: r.state_name ?? null,
    distributor: r.distributor_name ?? null,
  }));

  return <RetailerBrowser filterSource={rows} />;
}
