-- Seed data: authoritative catalogs and reserved usernames (PRD §7.7, §7.8).

-- Crop catalog launch defaults (PRD §7.7).
insert into public.crop_catalog (crop_id, seed_cost, growth_seconds, yield_amount, base_sale, unlock_lifetime, catalog_version, enabled)
values
  ('carrot',      10,   45, 1,  16,     0, 1, true),
  ('strawberry',  30,   90, 2,  20,     0, 1, true),
  ('tomato',      70,  180, 3,  32,   250, 1, true),
  ('corn',       160,  300, 3,  70,  1000, 1, true),
  ('pumpkin',    400,  480, 1, 600,  3000, 1, true),
  ('sunflower',  900,  720, 2, 600, 10000, 1, true)
on conflict (crop_id) do nothing;

-- Tool catalog: level costs and area patterns (PRD §7.8).
-- area: 1=single tile, 2=three-tile line, 3=3x3 square.
insert into public.tool_catalog (tool_id, level, cost, area, cooldown_ms, catalog_version)
values
  ('trowel',        1,    0, 1, 650, 1),
  ('trowel',        2,  750, 2, 450, 1),
  ('trowel',        3, 3500, 3, 300, 1),
  ('watering_can',  1,    0, 1, 650, 1),
  ('watering_can',  2,  750, 2, 450, 1),
  ('watering_can',  3, 3500, 3, 300, 1),
  ('seed_bag',      1,    0, 1, 650, 1),
  ('seed_bag',      2,  750, 2, 450, 1),
  ('seed_bag',      3, 3500, 3, 300, 1),
  ('scythe',        1,    0, 1, 650, 1),
  ('scythe',        2,  750, 2, 450, 1),
  ('scythe',        3, 3500, 3, 300, 1)
on conflict (tool_id, level) do nothing;

-- Reserved username patterns (moderation baseline).
insert into public.blocked_usernames (normalized_term, reason)
values
  ('admin', 'Reserved system name'),
  ('administrator', 'Reserved system name'),
  ('moderator', 'Reserved system name'),
  ('support', 'Reserved system name'),
  ('system', 'Reserved system name'),
  ('root', 'Reserved system name'),
  ('staff', 'Reserved system name'),
  ('official', 'Reserved system name'),
  ('verdant', 'Reserved product name'),
  ('gardenisland', 'Reserved product name'),
  ('gardenisland3d', 'Reserved product name'),
  ('supabase', 'Reserved vendor name')
on conflict (normalized_term) do nothing;
