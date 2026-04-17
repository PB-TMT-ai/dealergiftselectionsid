import { VOUCHER_MIN_POINTS, MAX_QTY_PER_GIFT } from "@/lib/constants";
import type { Gift, Suggestion } from "@/types/domain";

/**
 * Generate up to 3 suggested gift combos for a given point balance.
 *
 * Approach: brute-force (physical gifts have qty 0..MAX_QTY_PER_GIFT).
 * For 5 physical gifts × 4 qty options = 1024 combos — trivial.
 * After the physical combo, append a voucher for remainder if remainder ≥ 250.
 *
 * Edge cases:
 * - balance < 250              → no suggestions
 * - balance ≥ 250, < 750       → standalone voucher only
 * - balance can't be fully used → best-effort high-utilization suggestion
 */
export function suggestCombos(balance: number, catalog: Gift[]): Suggestion[] {
  if (balance < VOUCHER_MIN_POINTS) return [];

  const physical = catalog.filter((g) => !g.is_flexible && g.points_required != null);
  const voucher  = catalog.find((g) => g.is_flexible) ?? null;

  // If balance too small for any physical, just a voucher.
  const minPhysical = physical.reduce(
    (m, g) => Math.min(m, g.points_required ?? Infinity),
    Infinity
  );
  if (balance < minPhysical && voucher) {
    return [singleVoucher(voucher, balance)];
  }

  const candidates: Suggestion[] = [];
  const qtys = Array.from({ length: MAX_QTY_PER_GIFT + 1 }, (_, i) => i); // [0,1,2,3]

  // Recursive enumeration; bounded by physical.length (≤ 5 in this app).
  function walk(idx: number, acc: number, chosen: { gift: Gift; quantity: number; points: number }[]) {
    if (acc > balance) return;
    if (idx === physical.length) {
      const remaining = balance - acc;
      const items = [...chosen];
      let totalPoints = acc;
      if (voucher && remaining >= VOUCHER_MIN_POINTS) {
        items.push({ gift: voucher, quantity: 1, points: remaining });
        totalPoints += remaining;
      }
      if (items.length === 0) return;
      candidates.push({
        items,
        totalPoints,
        utilization: totalPoints / balance,
      });
      return;
    }
    const g = physical[idx];
    const unit = g.points_required!;
    for (const q of qtys) {
      const cost = unit * q;
      if (acc + cost > balance) break;
      const next = q === 0 ? chosen : [...chosen, { gift: g, quantity: q, points: cost }];
      walk(idx + 1, acc + cost, next);
    }
  }
  walk(0, 0, []);

  // Rank + dedupe (same totalPoints + same item signature).
  const seen = new Set<string>();
  const unique: Suggestion[] = [];
  for (const s of candidates.sort(rankSuggestion)) {
    const sig = s.items.map((i) => `${i.gift.id}:${i.quantity}:${i.points}`).sort().join("|");
    if (seen.has(sig)) continue;
    seen.add(sig);
    unique.push(s);
    if (unique.length >= 3) break;
  }
  return unique;
}

function singleVoucher(voucher: Gift, points: number): Suggestion {
  return {
    items: [{ gift: voucher, quantity: 1, points }],
    totalPoints: points,
    utilization: 1,
  };
}

// Ranking: higher utilization first, fewer items second.
// If two combos both fully consume the balance, prefer the one with fewer distinct items
// (easier to communicate to the retailer).
function rankSuggestion(a: Suggestion, b: Suggestion): number {
  if (b.utilization !== a.utilization) return b.utilization - a.utilization;
  return a.items.length - b.items.length;
}
