import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase-server";
import { GiftPicker } from "@components/GiftPicker";
import { formatPoints } from "@/lib/format";
import type { Gift, GiftSelection } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function RetailerPage({ params }: { params: { sfId: string } }) {
  const supabase = getServerSupabase();
  const sfId = decodeURIComponent(params.sfId);

  const [retailerRes, selectionsRes, catalogRes] = await Promise.all([
    supabase.from("retailers").select("*").eq("sf_id", sfId).maybeSingle(),
    supabase
      .from("gift_selections")
      .select("id, gift_id, points_used, quantity, notes")
      .eq("retailer_sf_id", sfId),
    supabase
      .from("gifts_catalog")
      .select("*")
      .order("is_flexible", { ascending: true })
      .order("points_required", { ascending: true }),
  ]);

  if (retailerRes.error || !retailerRes.data) notFound();
  const retailer = retailerRes.data;
  const initial = (selectionsRes.data ?? []) as GiftSelection[];
  const catalog = (catalogRes.data ?? []) as Gift[];

  return (
    <div className="space-y-4">
      <div>
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back
        </Link>
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900">{retailer.retailer_name}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {retailer.distributor_name ?? "—"} · {retailer.state_name ?? "—"} · {retailer.zone ?? "—"}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">SF Id: {retailer.sf_id}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Tile label="Earned" value={formatPoints(retailer.earned_points)} />
          <Tile
            label="Q4 Volume"
            value={retailer.q4_volume != null ? retailer.q4_volume.toLocaleString("en-IN") : "—"}
            sub="MT"
          />
        </div>
      </div>

      <GiftPicker
        retailer={retailer}
        catalog={catalog}
        initial={initial.map((s) => ({
          gift_id: s.gift_id,
          points_used: s.points_used,
          quantity: s.quantity,
          notes: s.notes ?? null,
        }))}
      />
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className="mt-1 font-semibold text-slate-900 text-base">{value}</div>
      {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
    </div>
  );
}
