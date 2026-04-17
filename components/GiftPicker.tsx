"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VOUCHER_MIN_POINTS, VOUCHER_POINTS_TO_INR } from "@/lib/constants";
import { suggestCombos } from "@/lib/suggest";
import { formatINR, formatPoints } from "@/lib/format"; // formatINR used only for voucher displays
import type { Gift, Retailer, Suggestion } from "@/types/domain";

interface PickerItem {
  gift_id: string;
  points_used: number;
  quantity: number;
  notes: string | null;
}

interface Props {
  retailer: Retailer;
  catalog: Gift[];
  initial: PickerItem[];
}

// Internal state: map of gift_id → { quantity (physical) or points (voucher) }
type PickerState = Record<string, { quantity: number; points: number }>;

export function GiftPicker({ retailer, catalog, initial }: Props) {
  const router = useRouter();
  const voucher = catalog.find((g) => g.is_flexible) ?? null;
  const physical = catalog.filter((g) => !g.is_flexible);

  const [state, setState] = useState<PickerState>(() => {
    const s: PickerState = {};
    for (const it of initial) {
      s[it.gift_id] = { quantity: it.quantity, points: it.points_used };
    }
    return s;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const totalUsed = useMemo(
    () => Object.values(state).reduce((s, x) => s + x.points, 0),
    [state]
  );
  const balance = retailer.earned_points - totalUsed;

  const voucherPoints = voucher ? state[voucher.id]?.points ?? 0 : 0;
  const remainingForVoucher = balance + voucherPoints; // if voucher removed, this would be free

  function setPhysical(g: Gift, qty: number) {
    setError(null);
    setState((prev) => {
      const next = { ...prev };
      if (qty <= 0) {
        delete next[g.id];
      } else {
        next[g.id] = { quantity: qty, points: (g.points_required ?? 0) * qty };
      }
      return next;
    });
  }

  function setVoucher(points: number) {
    setError(null);
    setState((prev) => {
      const next = { ...prev };
      if (!voucher) return prev;
      if (points <= 0) {
        delete next[voucher.id];
      } else {
        next[voucher.id] = { quantity: 1, points };
      }
      return next;
    });
  }

  function applySuggestion(s: Suggestion) {
    const next: PickerState = {};
    for (const it of s.items) {
      next[it.gift.id] = { quantity: it.quantity, points: it.points };
    }
    setState(next);
    setError(null);
    setToast("Suggestion applied");
    setTimeout(() => setToast(null), 1500);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const selections = Object.entries(state).map(([gift_id, v]) => ({
        gift_id,
        points_used: v.points,
        quantity: v.quantity,
      }));
      const res = await fetch("/api/selections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sfId: retailer.sf_id, selections }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Save failed");
        return;
      }
      setToast("Saved");
      router.refresh();
      setTimeout(() => setToast(null), 2000);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  // Suggestions computed for the current earned-points balance (not the dynamic one).
  const suggestions = useMemo(
    () => suggestCombos(retailer.earned_points, catalog),
    [retailer.earned_points, catalog]
  );

  const voucherEnabled = !!voucher && remainingForVoucher >= VOUCHER_MIN_POINTS;

  return (
    <div className="space-y-4">
      {/* Balance summary */}
      <div className="card p-4 sticky top-16 z-[5] bg-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">Remaining</div>
            <div className="mt-0.5 text-2xl font-semibold text-slate-900">
              {formatPoints(balance)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Used</div>
            <div className="text-sm font-medium text-slate-900">{formatPoints(totalUsed)}</div>
            <div className="text-xs text-slate-500 mt-1">of {formatPoints(retailer.earned_points)}</div>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full ${balance < 0 ? "bg-red-500" : "bg-brand-600"}`}
            style={{ width: `${Math.min(100, (totalUsed / Math.max(retailer.earned_points, 1)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-900">Suggested combos</h3>
          <p className="text-xs text-slate-500 mt-0.5">Tap one to apply. You can still edit after.</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => applySuggestion(s)}
                className="text-left rounded-md border border-slate-200 hover:border-brand-500 hover:bg-brand-50/50 p-3 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-brand-700">
                    {Math.round(s.utilization * 100)}% utilization
                  </span>
                  <span className="text-xs text-slate-500">{formatPoints(s.totalPoints)}</span>
                </div>
                <ul className="mt-2 text-xs text-slate-700 space-y-0.5">
                  {s.items.map((it, j) => (
                    <li key={j}>
                      {it.gift.is_flexible
                        ? `Voucher · ${formatPoints(it.points)} (${formatINR(it.points * VOUCHER_POINTS_TO_INR)})`
                        : `${it.quantity}× ${it.gift.name}`}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gift list */}
      <div className="card divide-y divide-slate-200">
        {physical.map((g) => {
          const cur = state[g.id]?.quantity ?? 0;
          const unit = g.points_required ?? 0;
          const affordableMaxExtra = Math.floor((balance + cur * unit) / unit);
          const canIncrement = cur < affordableMaxExtra;
          const disabledNew = cur === 0 && unit > balance;

          return (
            <div key={g.id} className="p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-slate-900 truncate">{g.name}</h4>
                  {g.slab && <span className="chip">Slab {g.slab}</span>}
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {formatPoints(g.points_required)} each
                </p>
              </div>
              <QtyStepper
                value={cur}
                disabled={disabledNew}
                canIncrement={canIncrement}
                onChange={(n) => setPhysical(g, n)}
              />
            </div>
          );
        })}

        {voucher && (
          <div className="p-4">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-slate-900">{voucher.name}</h4>
              <span className="chip bg-amber-50 text-amber-800">Flexible</span>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Minimum {VOUCHER_MIN_POINTS} points · 1 point = ₹{VOUCHER_POINTS_TO_INR}
            </p>
            {!voucherEnabled ? (
              <p className="mt-3 text-sm text-slate-500">
                Voucher unavailable — need at least {formatPoints(VOUCHER_MIN_POINTS)} remaining.
              </p>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min={VOUCHER_MIN_POINTS}
                  step={10}
                  max={remainingForVoucher}
                  value={voucherPoints || ""}
                  onChange={(e) => setVoucher(Number(e.target.value || 0))}
                  placeholder="Points"
                  className="input w-32"
                  inputMode="numeric"
                />
                <button
                  className="btn-secondary"
                  onClick={() => setVoucher(remainingForVoucher)}
                >
                  Use all {remainingForVoucher}
                </button>
                {voucherPoints > 0 && (
                  <button className="text-sm text-red-600 hover:underline ml-auto" onClick={() => setVoucher(0)}>
                    Remove
                  </button>
                )}
              </div>
            )}
            {voucherPoints > 0 && (
              <p className="mt-2 text-xs text-slate-600">
                ≈ {formatINR(voucherPoints * VOUCHER_POINTS_TO_INR)} voucher value
              </p>
            )}
            {voucherPoints > 0 && voucherPoints < VOUCHER_MIN_POINTS && (
              <p className="mt-1 text-xs text-red-600">Minimum {VOUCHER_MIN_POINTS} points</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 sm:mx-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          {Object.keys(state).length} item{Object.keys(state).length === 1 ? "" : "s"} · {formatPoints(totalUsed)} used
        </div>
        <button
          onClick={save}
          disabled={saving || balance < 0 || (voucherPoints > 0 && voucherPoints < VOUCHER_MIN_POINTS)}
          className="btn-primary"
        >
          {saving ? "Saving…" : "Save selections"}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm rounded-full px-4 py-2 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function QtyStepper({
  value, disabled, canIncrement, onChange,
}: {
  value: number; disabled: boolean; canIncrement: boolean; onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center rounded-md border border-slate-200 overflow-hidden">
      <button
        type="button"
        className="px-3 py-2 text-lg text-slate-700 disabled:opacity-40"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        aria-label="decrease"
      >
        −
      </button>
      <span className="w-8 text-center font-medium">{value}</span>
      <button
        type="button"
        className="px-3 py-2 text-lg text-slate-700 disabled:opacity-40"
        onClick={() => onChange(value + 1)}
        disabled={disabled || !canIncrement}
        aria-label="increase"
      >
        +
      </button>
    </div>
  );
}
