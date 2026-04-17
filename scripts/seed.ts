/**
 * Seed script — idempotent.
 *
 * Source: FY 26 Q4 dealer scheme Excel workbook with two sheets:
 *   • "Dealer data" — retailers (SF Id, name, distributor, state, zone, self-counter, Q4 vol, Points)
 *   • "Costing"     — gift catalog (New Gift, Gift value (INR))
 *
 * Physical gifts' points cost is DERIVED from ₹ value using POINTS_PER_INR (1 pt = ₹5).
 * Amazon voucher is flexible: stored with points_required=null, gift_value_inr=null;
 * runtime conversion uses VOUCHER_POINTS_TO_INR from src/lib/constants.ts.
 *
 * Usage (from repo root):
 *   npm run seed -- --file "C:\\Users\\2750834\\Downloads\\FY 26 Q4 dealer scheme_v2.xlsx"
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { readFileSync } from "fs";
import { resolve } from "path";

// Physical-gift rate. 1 point = ₹5 per the FY26 scheme (matches prior year's slab ratios).
const POINTS_PER_INR = 5;

// Load .env.local manually (tsx doesn't auto-load).
function loadEnv() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch { /* file optional */ }
}
loadEnv();

const args = process.argv.slice(2);
function arg(name: string): string | undefined {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  return args[i + 1];
}
const filePath = arg("--file");
if (!filePath) {
  console.error('Usage: npm run seed -- --file "<path-to-xlsx>"');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

type CostingRow = { "New Gift": string; "Gift value (INR)": number | null };
type DealerRow = {
  "SF Id": string;
  "Retailer Name": string;
  "Distributor Name": string | null;
  "State Name": string | null;
  "Distributor self-counter (Yes/No)": string | null;
  "Zone": string | null;
  "Q4 Vol. under eligible scheme": number | null;
  "Points": number | null;
};

function parseYesNo(v: string | null | undefined): boolean | null {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === "yes" || s === "y" || s === "true") return true;
  if (s === "no" || s === "n" || s === "false") return false;
  return null;
}

function parseNumeric(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function sheet<T>(wb: XLSX.WorkBook, name: string): T[] {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet "${name}" not found. Available: ${wb.SheetNames.join(", ")}`);
  return XLSX.utils.sheet_to_json<T>(ws, { defval: null });
}

async function main() {
  console.log(`Reading ${filePath} ...`);
  const wb = XLSX.readFile(filePath!);

  // ---------- Gift catalog ----------
  const costing = sheet<CostingRow>(wb, "Costing");
  const giftsRows = costing
    .filter((r) => r["New Gift"])
    .map((r) => {
      const name = String(r["New Gift"]).trim();
      const isVoucher = /amazon\s*voucher/i.test(name);
      const inrValue = r["Gift value (INR)"];
      return {
        name,
        slab: null as string | null, // FY26 removed slabs
        points_required: isVoucher ? null : inrValue != null ? Math.round(inrValue / POINTS_PER_INR) : null,
        gift_value_inr: isVoucher ? null : inrValue,
        is_flexible: isVoucher,
      };
    });

  console.log(`Upserting ${giftsRows.length} gifts...`);
  for (const g of giftsRows) {
    console.log(`  • ${g.name.padEnd(40)} ${g.is_flexible ? "[flexible]" : `${g.points_required} pts = ₹${g.gift_value_inr}`}`);
  }
  const { error: gErr } = await supabase
    .from("gifts_catalog")
    .upsert(giftsRows, { onConflict: "name" });
  if (gErr) throw gErr;

  // ---------- Retailers ----------
  const dealer = sheet<DealerRow>(wb, "Dealer data");
  const retailerRows = dealer
    .filter((r) => r["SF Id"])
    .map((r) => ({
      sf_id: String(r["SF Id"]).trim(),
      retailer_name: String(r["Retailer Name"] ?? "").trim() || "—",
      distributor_name: r["Distributor Name"]?.toString().trim().toUpperCase() ?? null,
      state_name: r["State Name"]?.toString().trim().toUpperCase() ?? null,
      district_name: null, // not in FY26 sheet
      zone: r["Zone"]?.toString().trim() ?? null,
      distributor_self_counter: parseYesNo(r["Distributor self-counter (Yes/No)"]),
      q4_volume: parseNumeric(r["Q4 Vol. under eligible scheme"]),
      earned_points: parseNumeric(r["Points"]) ?? 0,
      eligible_slab: null, // not in FY26 sheet
      max_eligible_gift: null, // not in FY26 sheet
    }));

  // Deduplicate by sf_id (sheet may contain duplicates; last-write-wins within a batch).
  const bySfId = new Map<string, typeof retailerRows[number]>();
  for (const r of retailerRows) bySfId.set(r.sf_id, r);
  const uniqueRetailers = [...bySfId.values()];
  if (uniqueRetailers.length !== retailerRows.length) {
    console.warn(`⚠ Found ${retailerRows.length - uniqueRetailers.length} duplicate SF Ids; kept last occurrence.`);
  }

  console.log(`Upserting ${uniqueRetailers.length} retailers...`);
  const batchSize = 200;
  for (let i = 0; i < uniqueRetailers.length; i += batchSize) {
    const chunk = uniqueRetailers.slice(i, i + batchSize);
    const { error } = await supabase.from("retailers").upsert(chunk, { onConflict: "sf_id" });
    if (error) throw error;
    process.stdout.write(`  batch ${Math.min(i + batchSize, uniqueRetailers.length)}/${uniqueRetailers.length}\r`);
  }
  process.stdout.write("\n");

  // ---------- App users ----------
  const users = [
    { name: "Admin",      pin: "9999", role: "admin" },
    { name: "SM North",   pin: "1111", role: "sm_tm" },
    { name: "TM Central", pin: "2222", role: "sm_tm" },
  ];
  console.log("Upserting app users...");
  const { error: uErr } = await supabase.from("app_users").upsert(users, { onConflict: "pin" });
  if (uErr) throw uErr;

  // ---------- Summary ----------
  const { count: rc } = await supabase.from("retailers").select("*", { count: "exact", head: true });
  const { count: gc } = await supabase.from("gifts_catalog").select("*", { count: "exact", head: true });
  const { count: uc } = await supabase.from("app_users").select("*", { count: "exact", head: true });

  console.log("\n✓ Seed complete.");
  console.log(`  gifts_catalog: ${gc}`);
  console.log(`  retailers:     ${rc}`);
  console.log(`  app_users:     ${uc}`);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
