-- Seed: Birthday Cake template
insert into templates (id, name, base_image_url, default_stickers)
values (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Birthday Cake',
  'https://www.figma.com/api/mcp/asset/22fdd466-c415-411f-8887-bc6afc6a2ef2',
  '[]'
)
on conflict do nothing;

-- Seed: Stickers (fruit category — placeholder URLs, replace with real Supabase Storage URLs)
insert into sticker_pool (template_id, image_url, category, weight)
values
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://www.figma.com/api/mcp/asset/05811d3e-f029-4fc8-8e45-fd7d407d5bd1', 'fruit', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://www.figma.com/api/mcp/asset/05811d3e-f029-4fc8-8e45-fd7d407d5bd1', 'fruit', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://www.figma.com/api/mcp/asset/05811d3e-f029-4fc8-8e45-fd7d407d5bd1', 'fruit', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://www.figma.com/api/mcp/asset/05811d3e-f029-4fc8-8e45-fd7d407d5bd1', 'fruit', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://www.figma.com/api/mcp/asset/05811d3e-f029-4fc8-8e45-fd7d407d5bd1', 'fruit', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://www.figma.com/api/mcp/asset/05811d3e-f029-4fc8-8e45-fd7d407d5bd1', 'text', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://www.figma.com/api/mcp/asset/05811d3e-f029-4fc8-8e45-fd7d407d5bd1', 'text', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'https://www.figma.com/api/mcp/asset/05811d3e-f029-4fc8-8e45-fd7d407d5bd1', 'text', 1)
on conflict do nothing;
