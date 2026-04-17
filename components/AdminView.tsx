"use client";

import { useMemo, useState } from "react";
import { formatINR, formatPoints } from "@/lib/format";
import type {
  Kpis, ConsolidatedRow, ZoneSummary, StateSummary, GiftSummary,
} from "@/lib/summary";

type Tab = "consolidated" | "zone" | "state" | "gift";

interface Payload {
  kpis: Kpis;
  consolidated: ConsolidatedRow[];
  zoneSummary: ZoneSummary[];
  stateSummary: StateSummary[];
  giftSummary: GiftSummary[];
}

export function AdminView({ payload }: { payload: Payload }) {
  const [tab, setTab] = useState<Tab>("consolidated");
  const [search, setSearch] = useState("");

  const filteredConsolidated = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payload.consolidated;
    return payload.consolidated.filter(
      (r) =>
        r.retailer_name.toLowerCase().includes(q) ||
        (r.distributor_name ?? "").toLowerCase().includes(q) ||
        (r.state_name ?? "").toLowerCase().includes(q)
    );
  }, [payload.consolidated, search]);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Retailers" value={payload.kpis.totalRetailers.toLocaleString()} />
        <Kpi label="Earned" value={formatPoints(payload.kpis.totalEarned)} />
        <Kpi label="Utilized" value={formatPoints(payload.kpis.totalUsed)} />
        <Kpi label="Utilization" value={`${payload.kpis.utilizationPct.toFixed(1)}%`} />
        <Kpi
          label="With / without"
          value={`${payload.kpis.withSelections} / ${payload.kpis.withoutSelections}`}
        />
      </div>

      {/* Tabs + export */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-x-auto -mx-4 px-4">
          {(["consolidated", "zone", "state", "gift"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap px-4 py-2 text-sm rounded-md mr-2 ${
                tab === t ? "bg-brand-600 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {{ consolidated: "Consolidated", zone: "Zone", state: "State", gift: "Gift" }[t]}
            </button>
          ))}
        </div>
        <a href="/admin/export" className="btn-primary ml-auto">
          Export .xlsx
        </a>
      </div>

      {tab === "consolidated" && (
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Search retailer, distributor, or state…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                  <tr>
                    <Th>Retailer</Th>
                    <Th>Distributor</Th>
                    <Th>State / Zone</Th>
                    <Th className="text-right">Earned</Th>
                    <Th className="text-right">Used</Th>
                    <Th className="text-right">Balance</Th>
                    <Th>Gifts</Th>
                    <Th className="text-right">Value</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredConsolidated.map((r) => (
                    <tr key={r.sf_id} className="hover:bg-slate-50">
                      <Td>
                        <div className="font-medium text-slate-900">{r.retailer_name}</div>
                        <div className="text-xs text-slate-400">{r.sf_id}</div>
                      </Td>
                      <Td>{r.distributor_name ?? "—"}</Td>
                      <Td>
                        <div>{r.state_name ?? "—"}</div>
                        <div className="text-xs text-slate-500">{r.zone ?? "—"}</div>
                      </Td>
                      <Td className="text-right tabular-nums">{r.earned_points.toLocaleString()}</Td>
                      <Td className="text-right tabular-nums">{r.points_used.toLocaleString()}</Td>
                      <Td className="text-right tabular-nums">{r.balance.toLocaleString()}</Td>
                      <Td className="max-w-xs truncate" title={r.gifts_summary}>{r.gifts_summary || "—"}</Td>
                      <Td className="text-right tabular-nums">{formatINR(r.total_value_inr)}</Td>
                    </tr>
                  ))}
                  {filteredConsolidated.length === 0 && (
                    <tr><Td colSpan={8} className="text-center text-slate-500">No results</Td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === "zone" && <SummaryTable rows={payload.zoneSummary} nameKey="zone" label="Zone" />}
      {tab === "state" && <SummaryTable rows={payload.stateSummary} nameKey="state" label="State" />}
      {tab === "gift" && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <Th>Gift</Th>
                  <Th className="text-right">Units</Th>
                  <Th className="text-right">Total points</Th>
                  <Th className="text-right">Total ₹ value</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payload.giftSummary.map((g) => (
                  <tr key={g.gift_id} className="hover:bg-slate-50">
                    <Td className="font-medium">{g.gift_name}</Td>
                    <Td className="text-right tabular-nums">{g.units.toLocaleString()}</Td>
                    <Td className="text-right tabular-nums">{g.points_total.toLocaleString()}</Td>
                    <Td className="text-right tabular-nums">{formatINR(g.value_inr)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function SummaryTable<T extends Record<string, any>>({
  rows, nameKey, label,
}: { rows: T[]; nameKey: keyof T; label: string }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <Th>{label}</Th>
              <Th className="text-right">Retailers</Th>
              <Th className="text-right">Earned</Th>
              <Th className="text-right">Used</Th>
              <Th className="text-right">Utilization</Th>
              <Th className="text-right">Value</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r[nameKey]} className="hover:bg-slate-50">
                <Td className="font-medium">{r[nameKey]}</Td>
                <Td className="text-right tabular-nums">{r.retailers.toLocaleString()}</Td>
                <Td className="text-right tabular-nums">{r.earned.toLocaleString()}</Td>
                <Td className="text-right tabular-nums">{r.used.toLocaleString()}</Td>
                <Td className="text-right tabular-nums">{(r.utilization * 100).toFixed(1)}%</Td>
                <Td className="text-right tabular-nums">{formatINR(r.value_inr)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="card overflow-hidden">{children}</div>;
}
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = "", colSpan, title }: { children: React.ReactNode; className?: string; colSpan?: number; title?: string }) {
  return <td colSpan={colSpan} title={title} className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
