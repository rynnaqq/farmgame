-- 0007: Free-placement farm contract (four 2x2 beds, direct planting, no till).
-- Additive migration: adds placement columns, backfills legacy rows, creates the
-- new single-tile farm_plant_at RPC, cleans harvest rows, and revokes the legacy
-- till/plant RPCs. Old functions are NOT dropped so a controlled rollback stays
-- possible (spec: "Free-Placement Farm Redesign", Persistence & Backend section).
--
-- Bed index contract (must equal src/game/world/farmLayout.ts):
--   0 = north-west, 1 = north-east, 2 = south-west, 3 = south-east
-- Bed-local bounds (must equal farmLayout.ts):
--   position_x in [-2.55, 2.55], position_z in [-2.25, 2.25]
-- Minimum plant spacing (must equal plantPlacement.ts): 1.1 => squared 1.21
-- Bed centers (must equal farmLayout.ts): X +/-3.8, Z +/-3.5

-- ---------------------------------------------------------------------------
-- 1. Additive placement columns + shape constraints
-- ---------------------------------------------------------------------------
alter table public.plot_tiles
  add column if not exists bed_id smallint,
  add column if not exists position_x real,
  add column if not exists position_z real;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'plot_tiles_bed_id_check'
  ) then
    alter table public.plot_tiles
      add constraint plot_tiles_bed_id_check
      check (bed_id is null or bed_id between 0 and 3) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'plot_tiles_placement_shape_check'
  ) then
    alter table public.plot_tiles
      add constraint plot_tiles_placement_shape_check
      check (
        (crop_id is null and bed_id is null and position_x is null and position_z is null)
        or
        (crop_id is not null and bed_id is not null and
         position_x between -2.55 and 2.55 and position_z between -2.25 and 2.25)
      ) not valid;
  end if;
end
$migration$;

-- ---------------------------------------------------------------------------
-- 2. Backfill legacy rows (same 4x4-per-quadrant rule as the local migration)
-- ---------------------------------------------------------------------------
update public.plot_tiles
set
  bed_id = case
    when tile_index / 8 < 4 and tile_index % 8 < 4 then 0
    when tile_index / 8 < 4 then 1
    when tile_index % 8 < 4 then 2
    else 3
  end,
  position_x = (((tile_index % 8) % 4) - 1.5) * 1.2,
  position_z = (((tile_index / 8) % 4) - 1.5) * 1.2
where crop_id is not null;

-- Empty rows carry no placement and are reset to state 0 (empty).
update public.plot_tiles
set state = 0, bed_id = null, position_x = null, position_z = null
where crop_id is null;

alter table public.plot_tiles validate constraint plot_tiles_bed_id_check;
alter table public.plot_tiles validate constraint plot_tiles_placement_shape_check;

-- ---------------------------------------------------------------------------
-- 3. World-coordinate helpers (must equal farmLayout.ts placementToWorldPoint)
-- ---------------------------------------------------------------------------
create or replace function public.farm_world_x(p_bed_id smallint, p_local_x real)
returns double precision language sql immutable as $$
  select (case when p_bed_id in (0, 2) then -3.8 else 3.8 end) + p_local_x;
$$;

create or replace function public.farm_world_z(p_bed_id smallint, p_local_z real)
returns double precision language sql immutable as $$
  select (case when p_bed_id in (0, 1) then -3.5 else 3.5 end) + p_local_z;
$$;

-- ---------------------------------------------------------------------------
-- 4. Tile patch rows now carry the placement columns
-- ---------------------------------------------------------------------------
create or replace function public.tile_patch_row(t public.plot_tiles)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'i', t.tile_index,
    'state', t.state,
    'crop', t.crop_id,
    'plantedAt', t.planted_at,
    'readyAt', t.ready_at,
    'mutation', t.mutation,
    'bedId', t.bed_id,
    'positionX', t.position_x,
    'positionZ', t.position_z
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. farm_plant_at: single-tile, placement-validating, atomic plant RPC
-- ---------------------------------------------------------------------------
create or replace function public.farm_plant_at(
  p_crop_id text,
  p_tile_index integer,
  p_bed_id smallint,
  p_position_x real,
  p_position_z real,
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
  v_seeds integer;
begin
  if v_owner is null then raise exception 'AUTH_INVALID'; end if;
  if p_crop_id is null then raise exception 'CATALOG_CHANGED'; end if;

  -- Placement validation (server is the final authority).
  if p_tile_index is null or p_tile_index < 0 or p_tile_index > 63
     or p_bed_id is null or p_bed_id < 0 or p_bed_id > 3
     or p_position_x is null or p_position_z is null then
    raise exception 'INVALID_PLACEMENT';
  end if;
  if p_position_x not between -2.55 and 2.55
     or p_position_z not between -2.25 and 2.25 then
    raise exception 'OUTSIDE_PLANTING_AREA';
  end if;

  select * into v_plot
  from public.plots where owner_id = v_owner for update;
  if not found then raise exception 'AUTH_INVALID'; end if;

  -- Idempotency digest includes crop, tile, bed, and 3-decimal coordinates.
  v_digest := md5(
    'plant_at|' || p_crop_id || '|' || p_tile_index || '|' || p_bed_id || '|' ||
    round(p_position_x::numeric, 3) || '|' || round(p_position_z::numeric, 3)
  );
  v_stored := public.idempotent_farm_result(v_owner, p_idempotency_key, 'plant_at', v_digest);
  if v_stored is not null then return v_stored; end if;

  select * into v_crop from public.crop_catalog where crop_id = p_crop_id and enabled;
  if not found then raise exception 'CATALOG_CHANGED'; end if;

  if exists (
    select 1 from public.profiles p
    where p.id = v_owner and p.lifetime_earned < v_crop.unlock_lifetime
  ) then
    raise exception 'CATALOG_LOCKED';
  end if;

  select level into v_level from public.player_tools
    where owner_id = v_owner and tool_id = 'seed_bag';
  if v_level is null then raise exception 'AUTH_INVALID'; end if;

  -- Lock seed inventory, plot, and all tile candidates for this plot.
  perform 1 from public.inventory_items
    where owner_id = v_owner and item_kind = 'seed' and item_id = p_crop_id
    for update;

  perform 1 from public.plot_tiles
  where plot_id = v_plot.id
  order by tile_index
  for update;

  -- Capacity: at most 64 active crops.
  if (select count(*) from public.plot_tiles
      where plot_id = v_plot.id and crop_id is not null) >= 64 then
    raise exception 'FARM_FULL';
  end if;

  -- Spacing: squared distance against every active crop must be >= 1.21.
  if exists (
    select 1 from public.plot_tiles t
    where t.plot_id = v_plot.id and t.crop_id is not null
      and power(public.farm_world_x(t.bed_id, t.position_x) -
                public.farm_world_x(p_bed_id, p_position_x), 2)
          + power(public.farm_world_z(t.bed_id, t.position_z) -
                  public.farm_world_z(p_bed_id, p_position_z), 2) < 1.21
  ) then
    raise exception 'OCCUPIED_POSITION';
  end if;

  -- Candidate tile must be free.
  if exists (
    select 1 from public.plot_tiles
    where plot_id = v_plot.id and tile_index = p_tile_index and crop_id is not null
  ) then
    raise exception 'INVALID_TILE_STATE';
  end if;

  -- Seed availability checked after all validation, then consumed atomically.
  select quantity into v_seeds from public.inventory_items
    where owner_id = v_owner and item_kind = 'seed' and item_id = p_crop_id;
  if v_seeds is null or v_seeds < 1 then
    raise exception 'INSUFFICIENT_ITEMS';
  end if;

  -- Weather at planting fixes ready_at; server time only.
  select weather into v_weather from public.world_state where singleton_id;
  v_ready_at := now() + make_interval(
    secs => v_crop.growth_seconds * public.weather_growth_multiplier(v_weather)
  );

  update public.plot_tiles
  set
    state = 3,
    crop_id = p_crop_id,
    planted_at = now(),
    ready_at = v_ready_at,
    mutation = 0,
    bed_id = p_bed_id,
    position_x = p_position_x,
    position_z = p_position_z,
    version = version + 1
  where plot_id = v_plot.id and tile_index = p_tile_index;

  update public.inventory_items
    set quantity = quantity - 1
    where owner_id = v_owner and item_kind = 'seed' and item_id = p_crop_id;

  update public.plots
    set version = version + 1, updated_at = now()
    where id = v_plot.id
    returning version into v_plot.version;

  perform public.record_farm_result(v_owner, v_plot.id, 'plant_at', p_idempotency_key, v_digest,
    jsonb_build_object(
      'ok', true,
      'kind', 'plant_at',
      'crop', p_crop_id,
      'plotVersion', v_plot.version,
      'tiles', coalesce((
        select jsonb_agg(public.tile_patch_row(t) order by t.tile_index)
        from public.plot_tiles t
        where t.plot_id = v_plot.id and t.tile_index = p_tile_index
      ), '[]'::jsonb)
    ));

  return (select result from public.farm_operations
    where owner_id = v_owner and idempotency_key = p_idempotency_key);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Harvest cleanup: state 0 (empty) with a fully nulled placement
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

  perform 1 from public.profiles where id = v_owner for update;

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

  -- Harvested tiles return to Empty (state 0) with a fully cleared placement.
  update public.plot_tiles
  set
    state = 0,
    crop_id = null,
    planted_at = null,
    ready_at = null,
    mutation = 0,
    bed_id = null,
    position_x = null,
    position_z = null,
    version = version + 1
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

-- ---------------------------------------------------------------------------
-- 7. Revoke legacy till/plant RPCs; grant the new one
-- ---------------------------------------------------------------------------
revoke all on function public.farm_till(integer[], uuid) from public, anon, authenticated;
revoke all on function public.farm_plant(text, integer[], uuid) from public, anon, authenticated;
grant execute on function public.farm_plant_at(text, integer, smallint, real, real, uuid)
  to authenticated;
