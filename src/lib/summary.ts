import { VOUCHER_POINTS_TO_INR } from "@/lib/constants";

interface Retailer {
  sf_id: string;
  retailer_name: string;
  distributor_name: string | null;
  state_name: string | null;
  district_name: string | null;
  zone: string | null;
  earned_points: number;
  eligible_slab: string | null;
  max_eligible_gift: string | null;
}
interface GiftJoined {
  id: string;
  name: string;
  is_flexible: boolean;
  gift_value_inr: number | null;
  points_required: number | null;
}
interface SelectionRowRaw {
  retailer_sf_id: string;
  gift_id: string;
  points_used: number;
  quantity: number;
  // Supabase returns the joined relation as an object OR an array depending on relationship detection.
  gift: GiftJoined | GiftJoined[] | null;
}
interface SelectionRow extends Omit<SelectionRowRaw, "gift"> {
  gift: GiftJoined | null;
}

function normalizeSelection(r: SelectionRowRaw): SelectionRow {
  const g = Array.isArray(r.gift) ? r.gift[0] ?? null : r.gift;
  return { retailer_sf_id: r.retailer_sf_id, gift_id: r.gift_id, points_used: r.points_used, quantity: r.quantity, gift: g };
}
interface Gift {
  id: string;
  name: string;
  is_flexible: boolean;
  gift_value_inr: number | null;
  points_required: number | null;
}

export function valueForSelection(sel: SelectionRow): number {
  if (!sel.gift) return 0;
  return sel.gift.is_flexible
    ? sel.points_used * VOUCHER_POINTS_TO_INR
    : sel.quantity * (sel.gift.gift_value_inr ?? 0);
}

export interface ConsolidatedRow extends Retailer {
  points_used: number;
  balance: number;
  gifts_summary: string;
  total_value_inr: number;
}
export interface ZoneSummary   { zone: string; retailers: number; earned: number; used: number; utilization: number; value_inr: number; }
export interface StateSummary  { state: string; retailers: number; earned: number; used: number; utilization: number; value_inr: number; }
export interface GiftSummary   { gift_id: string; gift_name: string; units: number; points_total: number; value_inr: number; }
export interface Kpis {
  totalRetailers: number;
  totalEarned: number;
  totalUsed: number;
  utilizationPct: number;
  withSelections: number;
  withoutSelections: number;
}

export function buildSummaries(retailers: Retailer[], selectionsRaw: SelectionRowRaw[], catalog: Gift[]) {
  const selections = selectionsRaw.map(normalizeSelection);
  // Index selections by retailer
  const byRetailer = new Map<string, SelectionRow[]>();
  for (const s of selections) {
    const arr = byRetailer.get(s.retailer_sf_id) ?? [];
    arr.push(s);
    byRetailer.set(s.retailer_sf_id, arr);
  }

  const consolidated: ConsolidatedRow[] = retailers.map((r) => {
    const sels = byRetailer.get(r.sf_id) ?? [];
    const points_used = sels.reduce((s, x) => s + (x.points_used ?? 0), 0);
    const total_value_inr = sels.reduce((s, x) => s + valueForSelection(x), 0);
    const gifts_summary = sels
      .filter((x) => x.gift?.name)
      .map((x) => (x.quantity > 1 ? `${x.quantity}× ${x.gift!.name}` : x.gift!.name))
      .join(", ");
    return { ...r, points_used, balance: r.earned_points - points_used, gifts_summary, total_value_inr };
  });

  // Zone summary
  const zoneMap = new Map<string, ZoneSummary>();
  for (const c of consolidated) {
    const key = c.zone ?? "—";
    const cur = zoneMap.get(key) ?? { zone: key, retailers: 0, earned: 0, used: 0, utilization: 0, value_inr: 0 };
    cur.retailers += 1;
    cur.earned += c.earned_points;
    cur.used += c.points_used;
    cur.value_inr += c.total_value_inr;
    zoneMap.set(key, cur);
  }
  const zoneSummary = [...zoneMap.values()].map((z) => ({
    ...z,
    utilization: z.earned ? z.used / z.earned : 0,
  }));

  // State summary
  const stateMap = new Map<string, StateSummary>();
  for (const c of consolidated) {
    const key = c.state_name ?? "—";
    const cur = stateMap.get(key) ?? { state: key, retailers: 0, earned: 0, used: 0, utilization: 0, value_inr: 0 };
    cur.retailers += 1;
    cur.earned += c.earned_points;
    cur.used += c.points_used;
    cur.value_inr += c.total_value_inr;
    stateMap.set(key, cur);
  }
  const stateSummary = [...stateMap.values()].map((s) => ({
    ...s,
    utilization: s.earned ? s.used / s.earned : 0,
  }));

  // Gift summary
  const giftMap = new Map<string, GiftSummary>();
  for (const s of selections) {
    if (!s.gift) continue;
    const cur = giftMap.get(s.gift.id) ?? {
      gift_id: s.gift.id,
      gift_name: s.gift.name,
      units: 0,
      points_total: 0,
      value_inr: 0,
    };
    cur.units += s.quantity;
    cur.points_total += s.points_used;
    cur.value_inr += valueForSelection(s);
    giftMap.set(s.gift.id, cur);
  }
  // Ensure every catalog gift appears (even with zero activity).
  for (const g of catalog) {
    if (!giftMap.has(g.id)) {
      giftMap.set(g.id, { gift_id: g.id, gift_name: g.name, units: 0, points_total: 0, value_inr: 0 });
    }
  }
  const giftSummary = [...giftMap.values()].sort((a, b) => b.points_total - a.points_total);

  // KPIs
  const totalRetailers = retailers.length;
  const totalEarned = retailers.reduce((s, r) => s + r.earned_points, 0);
  const totalUsed = consolidated.reduce((s, r) => s + r.points_used, 0);
  const withSelections = consolidated.filter((r) => r.points_used > 0).length;
  const kpis: Kpis = {
    totalRetailers,
    totalEarned,
    totalUsed,
    utilizationPct: totalEarned ? (totalUsed / totalEarned) * 100 : 0,
    withSelections,
    withoutSelections: totalRetailers - withSelections,
  };

  return { kpis, consolidated, zoneSummary, stateSummary, giftSummary };
}
