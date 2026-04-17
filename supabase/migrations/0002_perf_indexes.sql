-- Performance indexes + dashboard/list views.
-- Run in Supabase SQL editor after 0001_init.sql.
-- Fully idempotent — safe to re-run.

-- ---------- Indexes ----------

-- Partial index on earned_points > 0 (every list query filters on this).
create index if not exists retailers_earned_pos_idx
  on retailers (earned_points)
  where earned_points > 0;

-- Composite index for the common (zone, state, distributor) filter path.
create index if not exists retailers_zone_state_distributor_idx
  on retailers (zone, state_name, distributor_name);

-- Trigram index so `retailer_name ilike '%foo%'` uses an index scan
-- instead of a sequential scan. pg_trgm ships with Supabase.
create extension if not exists pg_trgm;
create index if not exists retailers_name_trgm_idx
  on retailers using gin (retailer_name gin_trgm_ops);

-- ---------- Views ----------

-- Feeds `/dashboard` with already-unique (zone, state, distributor) tuples.
-- Reduces dashboard payload from tens of KB to ~2–5 KB.
create or replace view dashboard_filter_options as
select zone, state_name, distributor_name
from retailers
where earned_points > 0
group by zone, state_name, distributor_name;

-- Feeds `/api/retailers` in one round-trip with a correct `count: "exact"`.
-- Replaces the old nested join + client-side `hasSelections` post-filter.
create or replace view retailers_with_summary as
select
  r.*,
  coalesce(s.points_used, 0)             as points_used,
  r.earned_points - coalesce(s.points_used, 0) as balance,
  coalesce(s.selection_count, 0)         as selection_count,
  coalesce(s.gifts_summary, '')          as gifts_summary
from retailers r
left join (
  select
    gs.retailer_sf_id,
    sum(gs.points_used)  as points_used,
    count(*)             as selection_count,
    string_agg(
      case when gs.quantity > 1 then gs.quantity || '× ' || gc.name else gc.name end,
      ', '
    )                    as gifts_summary
  from gift_selections gs
  join gifts_catalog gc on gc.id = gs.gift_id
  group by gs.retailer_sf_id
) s on s.retailer_sf_id = r.sf_id;
