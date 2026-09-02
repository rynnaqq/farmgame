-- Private Realtime authorization (PRD §9.6, §10.1, Supabase Realtime docs).
-- Topic format: room:{room_id}:presence | room:{room_id}:movement | room:{room_id}:farm
-- Membership is verified against active room leases (lease OR reclaim window),
-- so non-members and expired members cannot read or write room traffic.

-- Read: active room members may receive broadcasts and presence for their room topic.
create policy realtime_room_read on realtime.messages
  for select to authenticated
  using (
    exists (
      select 1
      from public.room_members m
      where m.user_id = (select auth.uid())
        and (m.lease_expires_at > now() or (m.reclaim_until is not null and m.reclaim_until > now()))
        and 'room:' || m.room_id::text = split_part((select realtime.topic()), ':', 1) || ':' || split_part((select realtime.topic()), ':', 2)
        and realtime.messages.extension in ('broadcast', 'presence')
    )
  );

-- Write: active room members may broadcast and track presence in their room topic.
create policy realtime_room_write on realtime.messages
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.room_members m
      where m.user_id = (select auth.uid())
        and (m.lease_expires_at > now() or (m.reclaim_until is not null and m.reclaim_until > now()))
        and 'room:' || m.room_id::text = split_part((select realtime.topic()), ':', 1) || ':' || split_part((select realtime.topic()), ':', 2)
        and realtime.messages.extension in ('broadcast', 'presence')
    )
  );
