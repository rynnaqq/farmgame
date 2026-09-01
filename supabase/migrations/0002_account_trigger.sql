-- Account-creation trigger (PRD §9.3).
-- Executes atomically after an Auth user is created: validates the username
-- from raw_user_meta_data, then creates profile, plot, 64 tiles, starter
-- inventory (5 carrot seeds), and 4 level-one tools.
-- SECURITY DEFINER with a fixed empty search_path; metadata is untrusted input.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_username text;
  canonical text;
  display text;
  blocked boolean;
begin
  raw_username := coalesce(new.raw_user_meta_data ->> 'username', '');

  -- Normalize: trim, then lowercase for uniqueness (AUTH-03).
  display := btrim(raw_username);
  canonical := lower(display);

  -- Reject missing, malformed, blocked, or duplicate usernames.
  if canonical !~ '^[a-z0-9]{3,16}$' then
    raise exception 'USERNAME_INVALID';
  end if;

  if exists (select 1 from public.blocked_usernames where normalized_term = canonical) then
    raise exception 'USERNAME_BLOCKED';
  end if;

  if exists (select 1 from public.profiles where username_canonical = canonical) then
    raise exception 'USERNAME_TAKEN';
  end if;

  -- 3. Create profiles with 100 starting coins (ONB-01).
  insert into public.profiles (id, username_canonical, username_display)
  values (new.id, canonical, display);

  -- 4. Create one 8x8 plots record.
  insert into public.plots (owner_id) values (new.id);

  -- 5. Create 64 Untilled plot_tiles rows.
  insert into public.plot_tiles (plot_id, tile_index)
  select p.id, s
  from public.plots p
  cross join generate_series(0, 63) as s
  where p.owner_id = new.id;

  -- 6. Add five Carrot seeds.
  insert into public.inventory_items (owner_id, item_kind, item_id, mutation, quantity)
  values (new.id, 'seed', 'carrot', 0, 5);

  -- 7. Create level-one records for all four tools.
  insert into public.player_tools (owner_id, tool_id, level)
  values
    (new.id, 'trowel', 1),
    (new.id, 'watering_can', 1),
    (new.id, 'seed_bag', 1),
    (new.id, 'scythe', 1);

  return new;
end;
$$;

-- Drop and recreate the trigger for idempotent migrations.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
