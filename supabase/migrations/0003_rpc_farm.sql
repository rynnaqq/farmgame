-- Farm RPC layer (PRD §9.4, §7.5, §7.6, §7.10, §12.3).
-- All functions: SECURITY DEFINER, fixed empty search_path, identity from auth.uid(),
-- server catalog values, server time, row locks, idempotency keys, bounded arrays.
-- Errors raise machine-readable codes (PRD §12.2) via the exception message.
--
-- Idempotency design: every function acquires its row locks FIRST, then checks
-- the stored operation result, so concurrent retries with the same key serialize
-- and the second caller receives the committed result without re-executing.

-- payload digest for farm_operations idempotency (added early; helper depends on it)
alter table public.farm_operations
  add column if not exists payload_digest text not null default '';

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- Uniform double in [0,1) from crypto-strong bytes (server-side mutation rolls).
create or replace function public.rand_uniform()
returns double precision
language sql
security definer
set search_path = ''
as $$
  select (('x' || substring(gen_random_bytes(4)::text from 1 for 8))::bit(32)::bigint)::double precision / 4294967296.0;
$$;

-- Mutation multipliers: normal 1, gold 5, giant 3, rainbow 15 (PRD §7.10).
create or replace function public.mutation_sale_multiplier(p_mutation smallint)
returns integer
language sql
immutable
as $$
  select case p_mutation
    when 1 then 5
    when 2 then 3
    when 3 then 15
    else 1
  end;
$$;

-- Roll one exclusive mutation from the harvest-weather probability table (PRD §7.10).
create or replace function public.roll_mutation(p_weather smallint)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  r double precision;
begin
  r := public.rand_uniform();
  if p_weather = 0 then        -- Sun: gold 4%, giant 2%, rainbow 0.25%
    if r < 0.04 then return 1;
    elseif r < 0.06 then return 2;
    elseif r < 0.0625 then return 3;
    else return 0; end if;
  elseif p_weather = 1 then    -- Rain: gold 1%, giant 6%, rainbow 0.25%
    if r < 0.01 then return 1;
    elseif r < 0.07 then return 2;
    elseif r < 0.0725 then return 3;
    else return 0; end if;
  elseif p_weather = 2 then    -- Heatwave: gold 7%, giant 1%, rainbow 0.5%
    if r < 0.07 then return 1;
    elseif r < 0.08 then return 2;
    elseif r < 0.085 then return 3;
    else return 0; end if;
  else                          -- Blood Moon: gold 5%, giant 3%, rainbow 4%
    if r < 0.05 then return 1;
    elseif r < 0.08 then return 2;
    elseif r < 0.12 then return 3;
    else return 0; end if;
  end if;
end;
$$;

-- Growth-duration multiplier applied at planting (PRD §7.9):
-- Sun 100%, Rain 85%, Heatwave 70%, Blood Moon 90%.
create or replace function public.weather_growth_multiplier(p_weather smallint)
returns double precision
language sql
immutable
as $$
  select case p_weather
    when 1 then 0.85
    when 2 then 0.70
    when 3 then 0.90
    else 1.0
  end;
$$;

-- Returns the stored result for (owner, key) when kind and payload digest match,
-- null when the key is unknown. Raises IDEMPOTENCY_MISMATCH on reuse with a
-- different function or payload (PRD §12.3).
create or replace function public.idempotent_farm_result(
  p_owner uuid,
  p_key uuid,
  p_kind text,
  p_payload_digest text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_result jsonb;
  v_digest text;
begin
  select kind, result, payload_digest into v_kind, v_result, v_digest
  from public.farm_operations
  where owner_id = p_owner and idempotency_key = p_key;

  if found then
    if v_kind <> p_kind or v_digest <> p_payload_digest then
      raise exception 'IDEMPOTENCY_MISMATCH';
    end if;
    return v_result;
  end if;
  return null;
end;
$$;

-- Records the farm operation result; the unique (owner_id, idempotency_key)
-- index makes this the linearization point of every farm mutation.
create or replace function public.record_farm_result(
  p_owner uuid,
  p_plot_id uuid,
  p_kind text,
  p_key uuid,
  p_payload_digest text,
  p_result jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.farm_operations (owner_id, plot_id, kind, idempotency_key, result, payload_digest)
  values (p_owner, p_plot_id, p_kind, p_key, p_result, p_payload_digest)
  on conflict (owner_id, idempotency_key) do nothing;
$$;

-- Validate a tile batch: 1..9 entries, each 0..63, no duplicates (PRD §7.5).
create or replace function public.validate_tile_batch(p_tiles integer[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tiles is null or array_length(p_tiles, 1) is null
     or array_length(p_tiles, 1) < 1 or array_length(p_tiles, 1) > 9 then
    raise exception 'INVALID_TILE_BATCH';
  end if;
  if exists (select 1 from unnest(p_tiles) t where t < 0 or t > 63) then
    raise exception 'INVALID_TILE_BATCH';
  end if;
  if (select count(distinct t) from unnest(p_tiles) t) <> array_length(p_tiles, 1) then
    raise exception 'INVALID_TILE_BATCH';
  end if;
end;
$$;

-- Validate the submitted tile set is legal for the tool level (PRD §7.8):
-- level 1: exactly one tile.
-- level 2: all tiles inside one 3-tile horizontal or vertical line.
-- level 3: all tiles inside one 3x3 window.
create or replace function public.validate_tool_area(
  p_level smallint,
  p_tiles integer[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_min_row int;
  v_max_row int;
  v_min_col int;
  v_max_col int;
begin
  select min(t / 8), max(t / 8), min(t % 8), max(t % 8)
  into v_min_row, v_max_row, v_min_col, v_max_col
  from unnest(p_tiles) t;

  if p_level = 1 then
    if array_length(p_tiles, 1) <> 1 then
      raise exception 'INVALID_TOOL_AREA';
    end if;
  elseif p_level = 2 then
    if not (
      (v_min_row = v_max_row and v_max_col - v_min_col <= 2)
      or (v_min_col = v_max_col and v_max_row - v_min_row <= 2)
    ) then
      raise exception 'INVALID_TOOL_AREA';
    end if;
  elseif p_level = 3 then
    if v_max_row - v_min_row > 2 or v_max_col - v_min_col > 2 then
      raise exception 'INVALID_TOOL_AREA';
    end if;
  else
    raise exception 'INVALID_TOOL_AREA';
  end if;
end;
$$;

-- Compact tile row -> client patch record (PRD §10.4).
create or replace function public.tile_patch_row(t public.plot_tiles)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'i', t.tile_index,
    'state', t.state,
    'crop', t.crop_id,
    'plantedAt', t.planted_at,
    'readyAt', t.ready_at,
    'mutation', t.mutation
  );
$$;

-- ---------------------------------------------------------------------------
-- Shared driver for single-state tile transitions (till / water).
-- Locks the plot row, enforces idempotency, validates the tool level and tile
-- states, applies the transition, bumps versions, and records the result.
-- ---------------------------------------------------------------------------
create or replace function public.apply_simple_tile_action(
  p_kind text,
  p_tool_id text,
  p_required_state smallint,
  p_next_state smallint,
  p_tile_indices integer[],
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_plot record;
  v_stored jsonb;
  v_digest text;
  v_level smallint;
begin
  if v_owner is null then raise exception 'AUTH_INVALID'; end if;
  perform public.validate_tile_batch(p_tile_indices);

  select * into v_plot from public.plots where owner_id = v_owner for update;
  if not found then raise exception 'AUTH_INVALID'; end if;

  -- Idempotency check after the row lock: retries serialize here.
  v_digest := md5(p_kind || '|' || array_to_string(p_tile_indices, ','));
  v_stored := public.idempotent_farm_result(v_owner, p_idempotency_key, p_kind, v_digest);
  if v_stored is not null then return v_stored; end if;

  select level into v_level from public.player_tools
    where owner_id = v_owner and tool_id = p_tool_id;
  if v_level is null then raise exception 'AUTH_INVALID'; end if;
  perform public.validate_tool_area(v_level, p_tile_indices);

  perform 1 from public.plot_tiles
    where plot_id = v_plot.id and tile_index = any(p_tile_indices)
    order by tile_index for update;

  if exists (
    select 1 from public.plot_tiles
    where plot_id = v_plot.id and tile_index = any(p_tile_indices) and state <> p_required_state
  ) then
    raise exception 'INVALID_TILE_STATE';
  end if;

  update public.plot_tiles
    set state = p_next_state, version = version + 1
    where plot_id = v_plot.id and tile_index = any(p_tile_indices);

  update public.plots
    set version = version + 1, updated_at = now()
    where id = v_plot.id
    returning version into v_plot.version;

  perform public.record_farm_result(v_owner, v_plot.id, p_kind, p_idempotency_key, v_digest,
    jsonb_build_object(
      'ok', true,
      'kind', p_kind,
      'plotVersion', v_plot.version,
      'tiles', coalesce((
        select jsonb_agg(public.tile_patch_row(t) order by t.tile_index)
        from public.plot_tiles t
        where t.plot_id = v_plot.id and t.tile_index = any(p_tile_indices)
      ), '[]'::jsonb)
    ));

  return (select result from public.farm_operations
    where owner_id = v_owner and idempotency_key = p_idempotency_key);
end;
$$;

-- ---------------------------------------------------------------------------
-- farm_till
-- Trowel: Untilled (0) -> Tilled (1) (PRD §7.6).
-- ---------------------------------------------------------------------------
create or replace function public.farm_till(
  p_tile_indices integer[],
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.apply_simple_tile_action(
    'till', 'trowel', 0, 1, p_tile_indices, p_idempotency_key
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- farm_water
-- Watering Can: Tilled (1) -> Watered (2) (PRD §7.6).
-- ---------------------------------------------------------------------------
create or replace function public.farm_water(
  p_tile_indices integer[],
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.apply_simple_tile_action(
    'water', 'watering_can', 1, 2, p_tile_indices, p_idempotency_key
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- farm_plant
-- ---------------------------------------------------------------------------
create or replace function public.farm_plant(
  p_crop_id text,
  p_tile_indices integer[],
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_plot record;
  v_crop record;
  v_weather smallint;
  v_stored jsonb;
  v_digest text;
  v_level smallint;
  v_ready_at timestamptz;
  v_needed integer;
  v_seeds integer;
begin
  if v_owner is null then raise exception 'AUTH_INVALID'; end if;
  if p_crop_id is null then raise exception 'CATALOG_CHANGED'; end if;
  perform public.validate_tile_batch(p_tile_indices);

  select * into v_plot from public.plots where owner_id = v_owner for update;
  if not found then raise exception 'AUTH_INVALID'; end if;

  v_digest := md5('plant|' || p_crop_id || '|' || array_to_string(p_tile_indices, ','));
  v_stored := public.idempotent_farm_result(v_owner, p_idempotency_key, 'plant', v_digest);
  if v_stored is not null then return v_stored; end if;

  select * into v_crop from public.crop_catalog where crop_id = p_crop_id and enabled;
  if not found then raise exception 'CATALOG_CHANGED'; end if;

  -- Unlock uses lifetime earned coins, not current balance (PRD §7.7).
  if exists (
    select 1 from public.profiles p
    where p.id = v_owner and p.lifetime_earned < v_crop.unlock_lifetime
  ) then
    raise exception 'CATALOG_LOCKED';
  end if;

  select level into v_level from public.player_tools
    where owner_id = v_owner and tool_id = 'seed_bag';
  if v_level is null then raise exception 'AUTH_INVALID'; end if;
  perform public.validate_tool_area(v_level, p_tile_indices);

  -- Lock seed inventory and tiles, then consume seeds and set timestamps.
  perform 1 from public.inventory_items
    where owner_id = v_owner and item_kind = 'seed' and item_id = p_crop_id
    for update;

  select quantity into v_seeds from public.inventory_items
    where owner_id = v_owner and item_kind = 'seed' and item_id = p_crop_id;
  v_needed := array_length(p_tile_indices, 1);
  if v_seeds is null or v_seeds < v_needed then
    raise exception 'INSUFFICIENT_ITEMS';
  end if;

  perform 1 from public.plot_tiles
    where plot_id = v_plot.id and tile_index = any(p_tile_indices)
    order by tile_index for update;

  if exists (
    select 1 from public.plot_tiles
    where plot_id = v_plot.id and tile_index = any(p_tile_indices) and state <> 2
  ) then
    raise exception 'INVALID_TILE_STATE';
  end if;

  -- Weather at planting fixes ready_at (PRD §7.9); server time only.
  select weather into v_weather from public.world_state where singleton_id;
  v_ready_at := now() + make_interval(secs => v_crop.growth_seconds * public.weather_growth_multiplier(v_weather));

  update public.plot_tiles
    set state = 3, crop_id = p_crop_id, planted_at = now(), ready_at = v_ready_at, version = version + 1
    where plot_id = v_plot.id and tile_index = any(p_tile_indices);

  update public.inventory_items
    set quantity = quantity - v_needed
    where owner_id = v_owner and item_kind = 'seed' and item_id = p_crop_id;

  update public.plots
    set version = version + 1, updated_at = now()
    where id = v_plot.id
    returning version into v_plot.version;

  perform public.record_farm_result(v_owner, v_plot.id, 'plant', p_idempotency_key, v_digest,
    jsonb_build_object(
      'ok', true,
      'kind', 'plant',
      'crop', p_crop_id,
      'plotVersion', v_plot.version,
      'tiles', coalesce((
        select jsonb_agg(public.tile_patch_row(t) order by t.tile_index)
        from public.plot_tiles t
        where t.plot_id = v_plot.id and t.tile_index = any(p_tile_indices)
      ), '[]'::jsonb)
    ));

  return (select result from public.farm_operations
    where owner_id = v_owner and idempotency_key = p_idempotency_key);
end;
$$;

-- ---------------------------------------------------------------------------
-- farm_harvest
-- Mutation is rolled exactly once, inside the harvest transaction (PRD §7.10).
-- ---------------------------------------------------------------------------
create or replace function public.farm_harvest(
  p_tile_indices integer[],
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_plot record;
  v_weather smallint;
  v_stored jsonb;
  v_digest text;
  v_level smallint;
  v_tile record;
  v_mutation smallint;
  v_crop record;
  v_total integer := 0;
  v_reveals jsonb := '[]'::jsonb;
begin
  if v_owner is null then raise exception 'AUTH_INVALID'; end if;
  perform public.validate_tile_batch(p_tile_indices);

  select * into v_plot from public.plots where owner_id = v_owner for update;
  if not found then raise exception 'AUTH_INVALID'; end if;

  v_digest := md5('harvest|' || array_to_string(p_tile_indices, ','));
  v_stored := public.idempotent_farm_result(v_owner, p_idempotency_key, 'harvest', v_digest);
  if v_stored is not null then return v_stored; end if;

  select level into v_level from public.player_tools
    where owner_id = v_owner and tool_id = 'scythe';
  if v_level is null then raise exception 'AUTH_INVALID'; end if;
  perform public.validate_tool_area(v_level, p_tile_indices);

  -- Lock the profile row so concurrent harvests serialize (acceptance: one reward).
  perform 1 from public.profiles where id = v_owner for update;

  -- Weather at harvest determines mutation probabilities (PRD §7.10).
  select weather into v_weather from public.world_state where singleton_id;

  perform 1 from public.plot_tiles
    where plot_id = v_plot.id and tile_index = any(p_tile_indices)
    order by tile_index for update;

  if exists (
    select 1 from public.plot_tiles
    where plot_id = v_plot.id and tile_index = any(p_tile_indices)
      and (state <> 3 or ready_at is null or ready_at > now())
  ) then
    raise exception 'INVALID_TILE_STATE';
  end if;

  -- Roll per tile; all items from one tile share the tile's mutation (PRD §7.10).
  for v_tile in select * from public.plot_tiles
    where plot_id = v_plot.id and tile_index = any(p_tile_indices)
    order by tile_index
  loop
    select * into v_crop from public.crop_catalog where crop_id = v_tile.crop_id and enabled;
    if not found then raise exception 'CATALOG_CHANGED'; end if;

    v_mutation := public.roll_mutation(v_weather);
    v_total := v_total + v_crop.yield_amount;

    insert into public.inventory_items (owner_id, item_kind, item_id, mutation, quantity)
      values (v_owner, 'produce', v_tile.crop_id, v_mutation, v_crop.yield_amount)
      on conflict (owner_id, item_kind, item_id, mutation)
      do update set quantity = public.inventory_items.quantity + excluded.quantity;

    v_reveals := v_reveals || jsonb_build_object(
      'i', v_tile.tile_index,
      'crop', v_tile.crop_id,
      'mutation', v_mutation,
      'amount', v_crop.yield_amount
    );
  end loop;

  -- Reset harvested tiles to Tilled, not Untilled (PRD §7.6).
  update public.plot_tiles
    set state = 1, crop_id = null, planted_at = null, ready_at = null, version = version + 1
    where plot_id = v_plot.id and tile_index = any(p_tile_indices);

  update public.plots
    set version = version + 1, updated_at = now()
    where id = v_plot.id
    returning version into v_plot.version;

  perform public.record_farm_result(v_owner, v_plot.id, 'harvest', p_idempotency_key, v_digest,
    jsonb_build_object(
      'ok', true,
      'kind', 'harvest',
      'plotVersion', v_plot.version,
      'harvested', v_total,
      'reveals', v_reveals,
      'tiles', coalesce((
        select jsonb_agg(public.tile_patch_row(t) order by t.tile_index)
        from public.plot_tiles t
        where t.plot_id = v_plot.id and t.tile_index = any(p_tile_indices)
      ), '[]'::jsonb)
    ));

  return (select result from public.farm_operations
    where owner_id = v_owner and idempotency_key = p_idempotency_key);
end;
$$;
