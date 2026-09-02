
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
