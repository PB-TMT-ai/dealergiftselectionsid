-- Dealer Gift Scheme Directory — initial schema
-- Run this in Supabase SQL editor (Project → SQL editor → New query → paste → Run).

-- ---------- Tables ----------

create table if not exists gifts_catalog (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  slab            text,                 -- 'A'..'E', null for voucher
  points_required int,                  -- null for voucher (flexible)
  gift_value_inr  int,                  -- null for voucher
  is_flexible     boolean not null default false
);

create table if not exists retailers (
  sf_id                    text primary key,
  retailer_name            text not null,
  distributor_name         text,
  state_name               text,
  district_name            text,
  zone                     text,
  distributor_self_counter boolean,
  q4_volume                numeric,
  earned_points            int not null default 0,
  eligible_slab            text,
  max_eligible_gift        text
);

create table if not exists gift_selections (
  id              uuid primary key default gen_random_uuid(),
  retailer_sf_id  text not null references retailers(sf_id) on delete cascade,
  gift_id         uuid not null references gifts_catalog(id),
  points_used     int  not null check (points_used > 0),
  quantity        int  not null default 1 check (quantity > 0),
  selected_by     text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists app_users (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  pin  text not null unique,
  role text not null check (role in ('sm_tm','admin'))
);

-- ---------- Indexes ----------

create index if not exists retailers_distributor_idx on retailers (distributor_name);
create index if not exists retailers_state_idx       on retailers (state_name);
create index if not exists retailers_zone_idx        on retailers (zone);
create index if not exists gift_selections_retailer_idx on gift_selections (retailer_sf_id);

-- ---------- Atomic replace RPC ----------

create or replace function replace_selections(
  p_retailer   text,
  p_selections jsonb,   -- [{gift_id, points_used, quantity?, notes?}]
  p_user       text
) returns void
language plpgsql
as $$
declare
  v_earned    int;
  v_total     int := 0;
  v_voucher   uuid;
  r           jsonb;
begin
  select earned_points into v_earned from retailers where sf_id = p_retailer for update;
  if v_earned is null then
    raise exception 'retailer % not found', p_retailer;
  end if;

  select id into v_voucher from gifts_catalog where is_flexible = true limit 1;

  for r in select * from jsonb_array_elements(p_selections) loop
    if (r->>'points_used')::int <= 0 then
      raise exception 'points_used must be positive';
    end if;
    if (r->>'gift_id')::uuid = v_voucher and (r->>'points_used')::int < 250 then
      raise exception 'voucher minimum is 250 points';
    end if;
    v_total := v_total + (r->>'points_used')::int;
  end loop;

  if v_total > v_earned then
    raise exception 'total redeemed (%) exceeds earned points (%)', v_total, v_earned;
  end if;

  delete from gift_selections where retailer_sf_id = p_retailer;

  insert into gift_selections
    (retailer_sf_id, gift_id, points_used, quantity, selected_by, notes)
  select
    p_retailer,
    (sel->>'gift_id')::uuid,
    (sel->>'points_used')::int,
    coalesce((sel->>'quantity')::int, 1),
    p_user,
    sel->>'notes'
  from jsonb_array_elements(p_selections) as sel;
end;
$$;

-- ---------- Defense-in-depth trigger ----------

create or replace function check_voucher_min() returns trigger
language plpgsql as $$
declare v_is_voucher boolean;
begin
  select is_flexible into v_is_voucher from gifts_catalog where id = new.gift_id;
  if v_is_voucher and new.points_used < 250 then
    raise exception 'voucher minimum is 250 points (got %)', new.points_used;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_voucher_min on gift_selections;
create trigger trg_voucher_min
  before insert or update on gift_selections
  for each row execute function check_voucher_min();

-- ---------- RLS (block anon; service-role bypasses) ----------

alter table retailers        enable row level security;
alter table gift_selections  enable row level security;
alter table gifts_catalog    enable row level security;
alter table app_users        enable row level security;
-- No policies defined → anon reads blocked. API routes use service role key.
