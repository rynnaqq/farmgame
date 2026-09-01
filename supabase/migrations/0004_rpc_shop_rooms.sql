-- Shop/economy, room, weather, and leaderboard RPCs (PRD §9.4, §9.5, §7.7, §7.8, §7.11, §7.13).

-- Idempotency design mirrors the farm layer: lock the profile row first, then
-- check the stored transaction result, then execute once and record.
-- economy_transactions.metadata doubles as the stored success payload.

-- ---------------------------------------------------------------------------
-- shop_buy_seeds
-- ---------------------------------------------------------------------------
create or replace function public.shop_buy_seeds(
  p_crop_id text,
  p_quantity integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_crop record;
  v_stored jsonb;
  v_digest text;
  v_cost integer;
  v_balance integer;
begin
  if v_owner is null then raise exception 'AUTH_INVALID'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then
    raise exception 'INVALID_QUANTITY';
  end if;

  -- Lock the profile row so retries and concurrent calls serialize.
  perform 1 from public.profiles where id = v_owner for update;

  v_digest := md5('buy_seeds|' || p_crop_id || '|' || p_quantity::text);
  select metadata into v_stored from public.economy_transactions
    where owner_id = v_owner and idempotency_key = p_idempotency_key and kind = 'seed_purchase';
  if v_stored is not null then
    if v_stored ->> 'digest' <> v_digest then
      raise exception 'IDEMPOTENCY_MISMATCH';
    end if;
    return v_stored;
  end if;

  select * into v_crop from public.crop_catalog where crop_id = p_crop_id and enabled;
  if not found then raise exception 'CATALOG_CHANGED'; end if;

  if exists (select 1 from public.profiles p where p.id = v_owner and p.lifetime_earned < v_crop.unlock_lifetime) then
    raise exception 'CATALOG_LOCKED';
  end if;

  select balance into v_balance from public.profiles where id = v_owner;

  v_cost := v_crop.seed_cost * p_quantity;
  if v_balance < v_cost then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  update public.profiles
    set balance = balance - v_cost, balance_updated_at = now()
    where id = v_owner
    returning balance into v_balance;

  insert into public.inventory_items (owner_id, item_kind, item_id, mutation, quantity)
    values (v_owner, 'seed', p_crop_id, 0, p_quantity)
    on conflict (owner_id, item_kind, item_id, mutation)
    do update set quantity = public.inventory_items.quantity + excluded.quantity;

  insert into public.economy_transactions (owner_id, kind, amount, balance_after, idempotency_key, metadata)
    values (v_owner, 'seed_purchase', -v_cost, v_balance, p_idempotency_key,
            jsonb_build_object('digest', v_digest))
    on conflict (owner_id, idempotency_key) do nothing;

  update public.economy_transactions
    set metadata = jsonb_build_object(
      'ok', true,
      'kind', 'buy_seeds',
      'digest', v_digest,
      'crop', p_crop_id,
      'quantity', p_quantity,
      'cost', v_cost,
      'balance', v_balance
    )
    where owner_id = v_owner and idempotency_key = p_idempotency_key;

  return (select metadata from public.economy_transactions
    where owner_id = v_owner and idempotency_key = p_idempotency_key);
end;
$$;

-- ---------------------------------------------------------------------------
-- shop_sell_produce
-- p_lines: json array [{"crop":"carrot","mutation":0,"quantity":3}, ...]
-- ---------------------------------------------------------------------------
create or replace function public.shop_sell_produce(
  p_lines jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_stored jsonb;
  v_line jsonb;
  v_crop_id text;
  v_mutation smallint;
  v_quantity integer;
  v_have integer;
  v_crop record;
  v_unit integer;
  v_line_value integer;
  v_total integer := 0;
  v_balance integer;
  v_items jsonb := '[]'::jsonb;
  v_digest text;
begin
  if v_owner is null then raise exception 'AUTH_INVALID'; end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 50 then
    raise exception 'INVALID_QUANTITY';
  end if;

  -- Lock the profile before validating inventory so concurrent sells serialize.
  perform 1 from public.profiles where id = v_owner for update;

  v_digest := md5('sell|' || p_lines::text);
  select metadata into v_stored from public.economy_transactions
    where owner_id = v_owner and idempotency_key = p_idempotency_key and kind = 'produce_sale';
  if v_stored is not null then
    if v_stored ->> 'digest' <> v_digest then
      raise exception 'IDEMPOTENCY_MISMATCH';
    end if;
    return v_stored;
  end if;

  select balance into v_balance from public.profiles where id = v_owner;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_crop_id := v_line ->> 'crop';
    v_mutation := coalesce((v_line ->> 'mutation')::smallint, 0);
    v_quantity := (v_line ->> 'quantity')::int;

    if v_crop_id is null or v_quantity is null or v_quantity < 1 or v_quantity > 9999
       or v_mutation < 0 or v_mutation > 3 then
      raise exception 'INVALID_QUANTITY';
    end if;

    perform 1 from public.inventory_items
      where owner_id = v_owner and item_kind = 'produce'
        and item_id = v_crop_id and mutation = v_mutation
      for update;

    select quantity into v_have from public.inventory_items
      where owner_id = v_owner and item_kind = 'produce'
        and item_id = v_crop_id and mutation = v_mutation;

    if v_have is null or v_have < v_quantity then
      raise exception 'INSUFFICIENT_ITEMS';
    end if;

    select * into v_crop from public.crop_catalog where crop_id = v_crop_id and enabled;
    if not found then raise exception 'CATALOG_CHANGED'; end if;

    v_unit := v_crop.base_sale * public.mutation_sale_multiplier(v_mutation);
    v_line_value := v_unit * v_quantity;
    v_total := v_total + v_line_value;

    update public.inventory_items
      set quantity = quantity - v_quantity
      where owner_id = v_owner and item_kind = 'produce'
        and item_id = v_crop_id and mutation = v_mutation;

    v_items := v_items || jsonb_build_object(
      'crop', v_crop_id,
      'mutation', v_mutation,
      'quantity', v_quantity,
      'unitValue', v_unit,
      'total', v_line_value
    );
  end loop;

  update public.profiles
    set balance = balance + v_total,
        lifetime_earned = lifetime_earned + v_total,
        balance_updated_at = now()
    where id = v_owner
    returning balance into v_balance;

  insert into public.economy_transactions (owner_id, kind, amount, balance_after, idempotency_key, metadata)
    values (v_owner, 'produce_sale', v_total, v_balance, p_idempotency_key,
            jsonb_build_object('digest', v_digest))
    on conflict (owner_id, idempotency_key) do nothing;

  update public.economy_transactions
    set metadata = jsonb_build_object(
      'ok', true,
      'kind', 'sell_produce',
      'digest', v_digest,
      'total', v_total,
      'balance', v_balance,
      'items', v_items
    )
    where owner_id = v_owner and idempotency_key = p_idempotency_key;

  return (select metadata from public.economy_transactions
    where owner_id = v_owner and idempotency_key = p_idempotency_key);
end;
$$;

-- ---------------------------------------------------------------------------
-- shop_upgrade_tool
-- ---------------------------------------------------------------------------
create or replace function public.shop_upgrade_tool(
  p_tool_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_stored jsonb;
  v_level smallint;
  v_next record;
  v_balance integer;
  v_digest text;
begin
  if v_owner is null then raise exception 'AUTH_INVALID'; end if;
  if p_tool_id not in ('trowel', 'watering_can', 'seed_bag', 'scythe') then
    raise exception 'INVALID_TOOL';
  end if;

  perform 1 from public.profiles where id = v_owner for update;

  v_digest := md5('upgrade|' || p_tool_id);
  select metadata into v_stored from public.economy_transactions
    where owner_id = v_owner and idempotency_key = p_idempotency_key and kind = 'tool_upgrade';
  if v_stored is not null then
    if v_stored ->> 'digest' <> v_digest then
      raise exception 'IDEMPOTENCY_MISMATCH';
    end if;
    return v_stored;
  end if;

  perform 1 from public.player_tools where owner_id = v_owner and tool_id = p_tool_id for update;
  select level into v_level from public.player_tools
    where owner_id = v_owner and tool_id = p_tool_id;
  if v_level is null then raise exception 'AUTH_INVALID'; end if;
  if v_level >= 3 then raise exception 'ALREADY_MAX_LEVEL'; end if;

  select * into v_next from public.tool_catalog
    where tool_id = p_tool_id and level = v_level + 1;
  if not found then raise exception 'CATALOG_CHANGED'; end if;

  select balance into v_balance from public.profiles where id = v_owner;
  if v_balance < v_next.cost then
    raise exception 'INSUFFICIENT_FUNDS';
  end if;

  update public.profiles
    set balance = balance - v_next.cost, balance_updated_at = now()
    where id = v_owner
    returning balance into v_balance;

  update public.player_tools
    set level = v_next.level, updated_at = now()
    where owner_id = v_owner and tool_id = p_tool_id;

  insert into public.economy_transactions (owner_id, kind, amount, balance_after, idempotency_key, metadata)
    values (v_owner, 'tool_upgrade', -v_next.cost, v_balance, p_idempotency_key,
            jsonb_build_object('digest', v_digest))
    on conflict (owner_id, idempotency_key) do nothing;

  update public.economy_transactions
    set metadata = jsonb_build_object(
      'ok', true,
      'kind', 'upgrade_tool',
      'digest', v_digest,
      'tool', p_tool_id,
      'level', v_next.level,
      'cost', v_next.cost,
      'balance', v_balance
    )
    where owner_id = v_owner and idempotency_key = p_idempotency_key;

  return (select metadata from public.economy_transactions
    where owner_id = v_owner and idempotency_key = p_idempotency_key);
end;
$$;

-- ---------------------------------------------------------------------------
-- join_or_create_room: atomic matchmaking (PRD §7.13)
-- ---------------------------------------------------------------------------
create or replace function public.join_or_create_room()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_member record;
  v_room record;
  v_slot smallint;
  v_used_slots smallint[];
  v_reclaim record;
begin
  if v_owner is null then raise exception 'AUTH_INVALID'; end if;

  -- Close rooms with no live leases.
  update public.game_rooms r
    set status = 'closed'
    where r.status = 'open'
      and not exists (
        select 1 from public.room_members m
        where m.room_id = r.id and m.lease_expires_at > now()
      );

  -- Drop fully expired members outside the reclaim window.
  delete from public.room_members
    where lease_expires_at <= now()
      and (reclaim_until is null or reclaim_until <= now());

  -- Grace-period reclaim: keep the previous slot when reconnecting in time
  -- (45-second reclaim grace, PRD §7.13).
  select * into v_reclaim
  from public.room_members
  where user_id = v_owner
    and reclaim_until is not null and reclaim_until > now()
  order by joined_at desc
  limit 1
  for update;

  if found then
    update public.room_members
      set lease_expires_at = now() + interval '30 seconds', reclaim_until = null
      where room_id = v_reclaim.room_id and user_id = v_owner
      returning room_id, slot into v_member.room_id, v_member.slot;
    update public.game_rooms
      set last_activity_at = now(), status = 'open'
      where id = v_reclaim.room_id and status = 'closed';
    return jsonb_build_object(
      'ok', true,
      'roomId', v_member.room_id,
      'slot', v_member.slot,
      'reconnected', true
    );
  end if;

  -- Release any other live lease before joining a fresh room.
  delete from public.room_members
    where user_id = v_owner and lease_expires_at > now();

  -- Pick the oldest healthy open room with a free slot, row-locked.
  select * into v_room
  from public.game_rooms r
  where r.status = 'open'
    and r.last_activity_at > now() - interval '2 minutes'
    and (
      select count(*) from public.room_members m
      where m.room_id = r.id and m.lease_expires_at > now()
    ) < 4
  order by r.created_at
  limit 1
  for update skip locked;

  if not found then
    insert into public.game_rooms (status) values ('open') returning * into v_room;
  end if;

  select coalesce(array_agg(m.slot), '{}') into v_used_slots
  from public.room_members m
  where m.room_id = v_room.id and m.lease_expires_at > now();

  v_slot := 0;
  while v_slot < 4 loop
    exit when not (v_slot = any(v_used_slots));
    v_slot := v_slot + 1;
  end loop;

  if v_slot >= 4 then
    raise exception 'ROOM_FULL';
  end if;

  insert into public.room_members (room_id, user_id, slot, lease_expires_at)
    values (v_room.id, v_owner, v_slot, now() + interval '30 seconds');

  update public.game_rooms set last_activity_at = now() where id = v_room.id;

  return jsonb_build_object(
    'ok', true,
    'roomId', v_room.id,
    'slot', v_slot,
    'reconnected', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Lease lifecycle: an expiring lease moves into the reclaim window instead of
-- vanishing immediately, enabling the 45-second reconnect grace (PRD §7.13).
-- ---------------------------------------------------------------------------
create or replace function public.mark_expired_leases()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.room_members
    set reclaim_until = now() + interval '45 seconds'
    where lease_expires_at <= now()
      and reclaim_until is null;
$$;

-- ---------------------------------------------------------------------------
-- renew_room_lease / leave_room / get_room_snapshot
-- ---------------------------------------------------------------------------
create or replace function public.renew_room_lease(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_updated boolean;
begin
  if v_owner is null then raise exception 'AUTH_INVALID'; end if;

  perform public.mark_expired_leases();

  update public.room_members
    set lease_expires_at = now() + interval '30 seconds', reclaim_until = null
    where room_id = p_room_id and user_id = v_owner
      and (lease_expires_at > now() or (reclaim_until is not null and reclaim_until > now()))
    returning true into v_updated;

  if v_updated is not true then
    raise exception 'ROOM_RETRY';
  end if;

  update public.game_rooms set last_activity_at = now() where id = p_room_id;

  return jsonb_build_object('ok', true, 'roomId', p_room_id);
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
begin
  if v_owner is null then raise exception 'AUTH_INVALID'; end if;

  -- Leaving voluntarily releases the slot immediately (no reclaim grace).
  delete from public.room_members
    where room_id = p_room_id and user_id = v_owner;

  update public.game_rooms
    set status = 'closed'
    where id = p_room_id
      and not exists (
        select 1 from public.room_members m
        where m.room_id = p_room_id and m.lease_expires_at > now()
      );

  return jsonb_build_object('ok', true, 'roomId', p_room_id);
end;
$$;

create or replace function public.get_room_snapshot(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_members jsonb;
  v_plots jsonb;
  v_server_time timestamptz := now();
  v_weather record;
begin
  if v_owner is null then raise exception 'AUTH_INVALID'; end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = v_owner
      and (lease_expires_at > now() or (reclaim_until is not null and reclaim_until > now()))
  ) then
    raise exception 'ROOM_RETRY';
  end if;

  select jsonb_agg(jsonb_build_object(
    'userId', m.user_id,
    'slot', m.slot,
    'username', p.username_display
  ) order by m.slot) into v_members
  from public.room_members m
  join public.profiles p on p.id = m.user_id
  where m.room_id = p_room_id
    and (m.lease_expires_at > now() or (m.reclaim_until is not null and m.reclaim_until > now()));

  select jsonb_agg(jsonb_build_object(
    'ownerId', pl.owner_id,
    'version', pl.version,
    'tiles', (
      select jsonb_agg(public.tile_patch_row(t) order by t.tile_index)
      from public.plot_tiles t
      where t.plot_id = pl.id
    )
  ) order by pl.owner_id) into v_plots
  from public.plots pl
  where exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.user_id = pl.owner_id
      and (m.lease_expires_at > now() or (m.reclaim_until is not null and m.reclaim_until > now()))
  );

  select weather, epoch, starts_at, ends_at into v_weather from public.world_state where singleton_id;

  return jsonb_build_object(
    'ok', true,
    'roomId', p_room_id,
    'serverTime', v_server_time,
    'weather', to_jsonb(v_weather),
    'members', coalesce(v_members, '[]'::jsonb),
    'plots', coalesce(v_plots, '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- get_current_weather
-- ---------------------------------------------------------------------------
create or replace function public.get_current_weather()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ok', true,
    'weather', weather,
    'epoch', epoch,
    'startsAt', starts_at,
    'endsAt', ends_at,
    'serverTime', now()
  )
  from public.world_state
  where singleton_id;
$$;

-- ---------------------------------------------------------------------------
-- advance_weather_epoch: scheduler entry (Supabase Cron / manual call).
-- Weights: Sun 45%, Rain 30%, Heatwave 17%, Blood Moon 8%; the same weather
-- may not occur three times consecutively (PRD §7.9).
-- ---------------------------------------------------------------------------
create or replace function public.advance_weather_epoch()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current smallint;
  v_prev smallint;
  r double precision;
  v_next smallint;
begin
  select weather, previous_weather into v_current, v_prev
  from public.world_state where singleton_id for update;

  r := public.rand_uniform();
  if r < 0.45 then v_next := 0;
  elseif r < 0.75 then v_next := 1;
  elseif r < 0.92 then v_next := 2;
  else v_next := 3;
  end if;

  -- No three-in-a-row.
  if v_next = v_current and v_current = v_prev then
    if v_next = 0 then v_next := 1; else v_next := 0; end if;
  end if;

  update public.world_state
    set previous_weather = v_current,
        weather = v_next,
        epoch = epoch + 1,
        starts_at = now(),
        ends_at = now() + interval '5 minutes'
    where singleton_id;

  return jsonb_build_object('ok', true, 'weather', v_next);
end;
$$;

-- ---------------------------------------------------------------------------
-- checkpoint_client (PRD §9.4)
-- ---------------------------------------------------------------------------
create or replace function public.checkpoint_client(
  p_plot_version bigint,
  p_pending_keys uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_current bigint;
  v_recent_ops jsonb;
begin
  if v_owner is null then raise exception 'AUTH_INVALID'; end if;

  select version into v_current from public.plots where owner_id = v_owner;
  if v_current is null then raise exception 'AUTH_INVALID'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key', idempotency_key,
    'kind', kind,
    'result', result
  )), '[]'::jsonb) into v_recent_ops
  from public.farm_operations
  where owner_id = v_owner and idempotency_key = any(coalesce(p_pending_keys, '{}'::uuid[]));

  return jsonb_build_object(
    'ok', true,
    'plotVersion', v_current,
    'diverged', (p_plot_version is not null and p_plot_version <> v_current),
    'operations', v_recent_ops
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- top_10_leaderboard view (PRD §9.5)
-- ---------------------------------------------------------------------------
create or replace view public.top_10_leaderboard
with (security_invoker = true) as
select
  row_number() over (order by p.balance desc, p.balance_updated_at asc, p.username_canonical asc) as rank,
  p.id as profile_id,
  p.username_display,
  p.balance,
  p.balance_updated_at
from public.profiles p
where p.is_ranked = true
order by p.balance desc, p.balance_updated_at asc, p.username_canonical asc
limit 10;
