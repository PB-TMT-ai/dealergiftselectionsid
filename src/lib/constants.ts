// Single source of truth. Import everywhere (frontend, suggest, seed, export).
export const VOUCHER_MIN_POINTS = 250;
export const VOUCHER_POINTS_TO_INR = 4;
export const SLABS = ["A", "B", "C", "D", "E"] as const;
export type Slab = (typeof SLABS)[number];

// Qty range used by the suggestion generator.
export const MAX_QTY_PER_GIFT = 3;

export const ROLES = ["sm_tm", "admin"] as const;
export type Role = (typeof ROLES)[number];
