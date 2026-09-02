-- Row Level Security and minimal grants (PRD §9.6, §13.2).
-- RLS enabled on every exposed table; direct client writes to progression
-- data are denied — all trusted mutations flow through SECURITY DEFINER RPCs.

alter table public.profiles enable row level security;
alter table public.plots enable row level security;
alter table public.plot_tiles enable row level security;
alter table public.inventory_items enable row level security;
alter table public.player_tools enable row level security;
alter table public.crop_catalog enable row level security;
alter table public.tool_catalog enable row level security;
alter table public.game_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.world_state enable row level security;
alter table public.economy_transactions enable row level security;
alter table public.farm_operations enable row level security;
alter table public.blocked_usernames enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: read leaderboard-safe fields; owner updates only safe preferences.
-- Progression fields (balance, lifetime_earned, tutorial_complete, is_ranked,
-- username_*) are RPC/trigger-only.
-- ---------------------------------------------------------------------------
create policy profiles_read_authenticated on public.profiles
  for select to authenticated
  using (true);

create policy profiles_update_self_safe on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and username_canonical = (select username_canonical from public.profiles where id = auth.uid())
    and username_display = (select username_display from public.profiles where id = auth.uid())
    and balance = (select balance from public.profiles where id = auth.uid())
    and lifetime_earned = (select lifetime_earned from public.profiles where id = auth.uid())
    and balance_updated_at = (select balance_updated_at from public.profiles where id = auth.uid())
    and tutorial_complete in (true, false)
  );

-- ---------------------------------------------------------------------------
-- plots / plot_tiles: owner and active room members may read; no direct writes.
-- ---------------------------------------------------------------------------
create policy plots_read on public.plots
  for select to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.room_members m
      join public.game_rooms r on r.id = m.room_id
      where m.user_id = auth.uid()
        and (m.lease_expires_at > now() or (m.reclaim_until is not null and m.reclaim_until > now()))
        and (
          -- Same room as the plot owner, when the owner is also an active member.
          exists (
            select 1 from public.room_members om
            where om.room_id = m.room_id and om.user_id = plots.owner_id
              and (om.lease_expires_at > now() or (om.reclaim_until is not null and om.reclaim_until > now()))
          )
        )
    )
  );

create policy plot_tiles_read on public.plot_tiles
  for select to authenticated
  using (
    exists (
      select 1 from public.plots p
      where p.id = plot_tiles.plot_id
        and (
          p.owner_id = auth.uid()
          or exists (
            select 1 from public.room_members m
            join public.room_members om on om.room_id = m.room_id
            where m.user_id = auth.uid()
              and (m.lease_expires_at > now() or (m.reclaim_until is not null and m.reclaim_until > now()))
              and om.user_id = p.owner_id
              and (om.lease_expires_at > now() or (om.reclaim_until is not null and om.reclaim_until > now()))
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- inventory_items / player_tools: owner-only reads; no direct client writes.
-- ---------------------------------------------------------------------------
create policy inventory_owner_read on public.inventory_items
  for select to authenticated
  using (owner_id = auth.uid());

create policy player_tools_owner_read on public.player_tools
  for select to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- catalogs / world_state: authenticated read; writes are server-only.
-- ---------------------------------------------------------------------------
create policy crop_catalog_read on public.crop_catalog
  for select to authenticated
  using (true);

create policy tool_catalog_read on public.tool_catalog
  for select to authenticated
  using (true);

create policy world_state_read on public.world_state
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- game_rooms / room_members: active related members read required fields;
-- writes happen only through matchmaking/lease RPCs.
-- ---------------------------------------------------------------------------
create policy game_rooms_member_read on public.game_rooms
  for select to authenticated
  using (
    status = 'open'
    or exists (
      select 1 from public.room_members m
      where m.room_id = game_rooms.id and m.user_id = auth.uid()
        and (m.lease_expires_at > now() or (m.reclaim_until is not null and m.reclaim_until > now()))
    )
  );

create policy room_members_related_read on public.room_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.room_members me
      where me.user_id = auth.uid()
        and me.room_id = room_members.room_id
        and (me.lease_expires_at > now() or (me.reclaim_until is not null and me.reclaim_until > now()))
    )
  );

-- ---------------------------------------------------------------------------
-- economy_transactions / farm_operations: owner reads recent records;
-- inserts/updates/deletes denied to clients (RPCs use security definer).
-- ---------------------------------------------------------------------------
create policy economy_tx_owner_read on public.economy_transactions
  for select to authenticated
  using (
    owner_id = auth.uid()
    and created_at > now() - interval '7 days'
  );

create policy farm_ops_owner_read on public.farm_operations
  for select to authenticated
  using (
    owner_id = auth.uid()
    and created_at > now() - interval '7 days'
  );

-- ---------------------------------------------------------------------------
-- blocked_usernames: readable by authenticated clients for live validation UX.
-- ---------------------------------------------------------------------------
create policy blocked_usernames_read on public.blocked_usernames
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Minimal grants: authenticated role gets select-only on exposed tables.
-- No insert/update/delete grants — SECURITY DEFINER functions bypass RLS and
-- use owner-less database access, which is the only write path.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.plots to authenticated;
grant select on public.plot_tiles to authenticated;
grant select on public.inventory_items to authenticated;
grant select on public.player_tools to authenticated;
grant select on public.crop_catalog to authenticated;
grant select on public.tool_catalog to authenticated;
grant select on public.world_state to authenticated;
grant select on public.game_rooms to authenticated;
grant select on public.room_members to authenticated;
grant select on public.economy_transactions to authenticated;
grant select on public.farm_operations to authenticated;
grant select on public.blocked_usernames to authenticated;
grant select on public.top_10_leaderboard to authenticated;

-- Execute grants: only the public RPC functions the game client may call.
revoke all on function public.join_or_create_room() from public, anon, authenticated;
revoke all on function public.renew_room_lease(uuid) from public, anon, authenticated;
revoke all on function public.leave_room(uuid) from public, anon, authenticated;
revoke all on function public.get_room_snapshot(uuid) from public, anon, authenticated;
revoke all on function public.farm_till(integer[], uuid) from public, anon, authenticated;
revoke all on function public.farm_water(integer[], uuid) from public, anon, authenticated;
revoke all on function public.farm_plant(text, integer[], uuid) from public, anon, authenticated;
revoke all on function public.farm_harvest(integer[], uuid) from public, anon, authenticated;
revoke all on function public.shop_buy_seeds(text, integer, uuid) from public, anon, authenticated;
revoke all on function public.shop_sell_produce(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.shop_upgrade_tool(text, uuid) from public, anon, authenticated;
revoke all on function public.get_current_weather() from public, anon, authenticated;
revoke all on function public.checkpoint_client(bigint, uuid[]) from public, anon, authenticated;

grant execute on function public.join_or_create_room() to authenticated;
grant execute on function public.renew_room_lease(uuid) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;
grant execute on function public.get_room_snapshot(uuid) to authenticated;
grant execute on function public.farm_till(integer[], uuid) to authenticated;
grant execute on function public.farm_water(integer[], uuid) to authenticated;
grant execute on function public.farm_plant(text, integer[], uuid) to authenticated;
grant execute on function public.farm_harvest(integer[], uuid) to authenticated;
grant execute on function public.shop_buy_seeds(text, integer, uuid) to authenticated;
grant execute on function public.shop_sell_produce(jsonb, uuid) to authenticated;
grant execute on function public.shop_upgrade_tool(text, uuid) to authenticated;
grant execute on function public.get_current_weather() to authenticated;
grant execute on function public.checkpoint_client(bigint, uuid[]) to authenticated;

-- Internal helpers must never be callable by clients.
revoke all on function public.rand_uniform() from public, anon, authenticated;
revoke all on function public.roll_mutation(smallint) from public, anon, authenticated;
revoke all on function public.mutation_sale_multiplier(smallint) from public, anon, authenticated;
revoke all on function public.weather_growth_multiplier(smallint) from public, anon, authenticated;
revoke all on function public.idempotent_farm_result(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.record_farm_result(uuid, uuid, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.validate_tile_batch(integer[]) from public, anon, authenticated;
revoke all on function public.validate_tool_area(smallint, integer[]) from public, anon, authenticated;
revoke all on function public.tile_patch_row(public.plot_tiles) from public, anon, authenticated;
revoke all on function public.apply_simple_tile_action(text, text, smallint, smallint, integer[], uuid) from public, anon, authenticated;
revoke all on function public.mark_expired_leases() from public, anon, authenticated;
revoke all on function public.advance_weather_epoch() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
