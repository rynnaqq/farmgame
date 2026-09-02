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
    -- Reclaim only while the room still has capacity for us.
    if (
      select count(*) from public.room_members m
      where m.room_id = v_reclaim.room_id
        and m.user_id <> v_owner
        and (m.lease_expires_at > now() or (m.reclaim_until is not null and m.reclaim_until > now()))
    ) < 4 then
      update public.room_members
        set lease_expires_at = now() + interval '30 seconds', reclaim_until = null
        where room_id = v_reclaim.room_id and user_id = v_owner
        returning room_id, slot into v_member.room_id, v_member.slot;
      update public.game_rooms
        set last_activity_at = now(), status = 'open'
        where id = v_reclaim.room_id
          and status = 'closed'
          and not exists (
            select 1 from public.room_members m
            where m.room_id = v_reclaim.room_id and m.lease_expires_at > now()
          );
      return jsonb_build_object(
        'ok', true,
        'roomId', v_member.room_id,
        'slot', v_member.slot,
        'reconnected', true
      );
    else
      delete from public.room_members
        where room_id = v_reclaim.room_id and user_id = v_owner;
    end if;
  end if;

  -- Release any stale membership row before joining a fresh room
  -- (the unique index on user_id permits at most one row either way).
  delete from public.room_members
    where user_id = v_owner;

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
