import type { Role, Slab } from "@/lib/constants";

export type { Role, Slab };

export interface Gift {
  id: string;
  name: string;
  slab: Slab | null;
  points_required: number | null;
  gift_value_inr: number | null;
  is_flexible: boolean;
}

export interface Retailer {
  sf_id: string;
  retailer_name: string;
  distributor_name: string | null;
  state_name: string | null;
  district_name: string | null;
  zone: string | null;
  distributor_self_counter: boolean | null;
  q4_volume: number | null;
  earned_points: number;
  eligible_slab: Slab | null;
  max_eligible_gift: string | null;
}

export interface GiftSelection {
  id: string;
  retailer_sf_id: string;
  gift_id: string;
  points_used: number;
  quantity: number;
  selected_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GiftSelectionInput {
  gift_id: string;
  points_used: number;
  quantity?: number;
  notes?: string | null;
}

export interface RetailerWithSelections extends Retailer {
  selections: (GiftSelection & { gift: Gift })[];
}

export interface SessionUser {
  userId: string;
  name: string;
  role: Role;
}

export interface Suggestion {
  items: { gift: Gift; quantity: number; points: number }[];
  totalPoints: number;
  utilization: number; // 0..1
}
