import * as XLSX from "xlsx";
import type {
  ConsolidatedRow, ZoneSummary, StateSummary, GiftSummary,
} from "@/lib/summary";

interface Payload {
  consolidated: ConsolidatedRow[];
  zoneSummary: ZoneSummary[];
  stateSummary: StateSummary[];
  giftSummary: GiftSummary[];
}

export function buildWorkbook(payload: Payload): Buffer {
  const wb = XLSX.utils.book_new();

  const consolidated = payload.consolidated.map((r) => ({
    "SF Id": r.sf_id,
    "Retailer Name": r.retailer_name,
    "Distributor": r.distributor_name ?? "",
    "State": r.state_name ?? "",
    "District": r.district_name ?? "",
    "Zone": r.zone ?? "",
    "Slab": r.eligible_slab ?? "",
    "Earned Points": r.earned_points,
    "Used Points": r.points_used,
    "Balance": r.balance,
    "Gifts": r.gifts_summary,
    "Total Value (INR)": r.total_value_inr,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(consolidated), "Consolidated");

  const zone = payload.zoneSummary.map((z) => ({
    "Zone": z.zone,
    "Retailers": z.retailers,
    "Earned": z.earned,
    "Used": z.used,
    "Utilization (%)": Number((z.utilization * 100).toFixed(2)),
    "Total Value (INR)": z.value_inr,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(zone), "Zone Summary");

  const state = payload.stateSummary.map((s) => ({
    "State": s.state,
    "Retailers": s.retailers,
    "Earned": s.earned,
    "Used": s.used,
    "Utilization (%)": Number((s.utilization * 100).toFixed(2)),
    "Total Value (INR)": s.value_inr,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(state), "State Summary");

  const gifts = payload.giftSummary.map((g) => ({
    "Gift": g.gift_name,
    "Units Selected": g.units,
    "Total Points": g.points_total,
    "Total Value (INR)": g.value_inr,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gifts), "Gift Summary");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
