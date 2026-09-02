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

