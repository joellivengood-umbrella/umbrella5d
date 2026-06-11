-- 5D Machine — DEMO SEED (safe to delete later)
--
-- RUN THIS AFTER 20260608_machine_structure.sql.
--
-- Seeds one Part (Part One — The Big Reduction) and its first lesson
-- (1.1), transcribed from the interface mockup, so the learner view has
-- real content to render. Everything is UNPUBLISHED, so it is invisible
-- to real users; a platform admin can preview it.
--
-- Lesson body uses the three named sections (prerequisites / objectives
-- / instructions). The structure file's section constraint accepts
-- these names directly, and 20260610_machine_three_sections.sql later
-- tightens the rule to the three names only.
--
-- Idempotent: fixed UUIDs + on-conflict upserts, so re-running re-syncs
-- the same rows without creating duplicates and without wiping any
-- answers/checks a previewer may have entered.

-- ── Part One ───────────────────────────────────────────────────────
insert into public.machine_parts (id, sort_index, title, subtitle, is_published)
values ('ddddffff-0000-0000-0000-000000000001', 1, 'The Big Reduction', null, false)
on conflict (id) do update set
  sort_index   = excluded.sort_index,
  title        = excluded.title,
  subtitle     = excluded.subtitle,
  is_published = excluded.is_published;

-- ── Lesson 1.1 (a machine content_item) ────────────────────────────
insert into public.content_items
  (id, type, sequence_num, title, description, media_url, duration_mins,
   metadata, is_published, part_id, part_sort_index)
values
  ('ddddffff-0000-0000-0000-000000000101', 'machine', 1,
   'Where Profit Comes From', null, null, null,
   '{}'::jsonb, false,
   'ddddffff-0000-0000-0000-000000000001', 1)
on conflict (id) do update set
  type            = excluded.type,
  sequence_num    = excluded.sequence_num,
  title           = excluded.title,
  is_published    = excluded.is_published,
  part_id         = excluded.part_id,
  part_sort_index = excluded.part_sort_index;

-- ── Lesson 1.1 blocks ──────────────────────────────────────────────
-- PREREQUISITES + OBJECTIVES (read sections; checkpoint headings are
-- numbered 1.1.1, 1.1.2… continuously across the two) and INSTRUCTIONS
-- (question items numbered 5D 1.1.1, 5D 1.1.2…).

insert into public.lesson_blocks
  (id, lesson_id, section, sort_index, block_type, data, is_checkpoint)
values
  -- prerequisites: step "Essential Prerequisites"
  ('ddddffff-0000-0000-0000-000000000201', 'ddddffff-0000-0000-0000-000000000101',
   'prerequisites', 1, 'heading',
   $j${"text":"Essential Prerequisites"}$j$::jsonb, true),

  ('ddddffff-0000-0000-0000-000000000202', 'ddddffff-0000-0000-0000-000000000101',
   'prerequisites', 2, 'rich_text',
   $j${"html":"<p>First, we need to establish exactly where profit comes from.</p><p>Businesses capture as <strong>PROFIT</strong> a portion of the <strong>VALUE</strong> created for the customer. Profit comes from nowhere else but value.</p><p>Where to start? At the very beginning, of course.</p><p>So you probably think it is about making money, right? That that is <strong>WHY</strong> you are in business. To make the big bucks.</p><p>Well, it does not work that way. We will teach you how to make sizeable profits. <strong>WE ARE REALLY GOOD AT THAT.</strong> It is, after all, the business we are in.</p><p>Yep, you have to make a profit. It is very difficult for most companies to survive without profits. But that is <strong>NOT</strong> the reason you are in business, and it is certainly not what you focus on.</p><p>Why can you not simply focus on profits? Because...</p><p><strong>Profit is an outcome, not an income.</strong></p>"}$j$::jsonb, false),

  -- No media file yet; url is omitted so the player renders an
  -- "audio coming soon" placeholder until a Supabase Storage URL is set.
  ('ddddffff-0000-0000-0000-000000000203', 'ddddffff-0000-0000-0000-000000000101',
   'prerequisites', 3, 'audio',
   $j${"title":"Profit is an outcome, not an income"}$j$::jsonb, false),

  ('ddddffff-0000-0000-0000-000000000204', 'ddddffff-0000-0000-0000-000000000101',
   'prerequisites', 4, 'rich_text',
   $j${"html":"<p>Profits are a <strong>DIRECT RESULT OF OTHER THINGS</strong>, not a principal cause of anything. What is important is to determine exactly <strong>WHERE</strong> profits come from.</p><p>There is only <strong>ONE</strong> definition of where profit comes from that will help us understand why we are in business: businesses capture as profit a portion of the value created for the customer.</p><p><strong>BOOM! You must focus on VALUE, not profits.</strong></p><p>By the way, we use the economic term for value: <strong>UTILITY</strong>. Utility is used interchangeably with value.</p>"}$j$::jsonb, false),

  -- prerequisites: step "So What Then Is Value?"
  ('ddddffff-0000-0000-0000-000000000205', 'ddddffff-0000-0000-0000-000000000101',
   'prerequisites', 5, 'heading',
   $j${"text":"So What Then Is Value?"}$j$::jsonb, true),

  ('ddddffff-0000-0000-0000-000000000206', 'ddddffff-0000-0000-0000-000000000101',
   'prerequisites', 6, 'rich_text',
   $j${"html":"<p><strong>VALUE</strong> is the customer's benefit from the <strong>USE</strong> of your product or service. <strong>NOT THE PRODUCT ITSELF.</strong> You really, really need to understand this.</p><p>What does value look like? Like this: Black &amp; Decker does not sell quarter-inch <strong>DRILLS</strong>. They sell quarter-inch <strong>HOLES</strong>.</p><p>You think you sold them a drill (the product), but what they bought and paid for was the hole (the value, or benefit). Your profit is based entirely on the value you create.</p>"}$j$::jsonb, false),

  -- objectives: one demo step so all three sections render
  ('ddddffff-0000-0000-0000-000000000251', 'ddddffff-0000-0000-0000-000000000101',
   'objectives', 1, 'heading',
   $j${"text":"What You Will Learn"}$j$::jsonb, true),

  ('ddddffff-0000-0000-0000-000000000252', 'ddddffff-0000-0000-0000-000000000101',
   'objectives', 2, 'rich_text',
   $j${"html":"<p>By the end of this lesson you will know exactly where profit comes from, and why value, not profit, is the thing to manage.</p>"}$j$::jsonb, false),

  -- instructions: numbered question items + explanatory text
  ('ddddffff-0000-0000-0000-000000000302', 'ddddffff-0000-0000-0000-000000000101',
   'instructions', 1, 'question',
   $j${"prompts":["Detail EXACTLY what your customer actually RECEIVES from the use or consumption of your product.","What is the RESULT of the use of your product? Specifically, list the BENEFITS your customers receive."]}$j$::jsonb, true),

  ('ddddffff-0000-0000-0000-000000000303', 'ddddffff-0000-0000-0000-000000000101',
   'instructions', 2, 'rich_text',
   $j${"html":"<p>Here is an example of what we mean. Your accountant provides audits to people. They put together a bunch of numbers and certify them as accurate.</p><p>Most businesses are not paying for the numbers; they pretty much know them already. They are paying for their own <strong>PEACE OF MIND</strong> that their calculations were accurate, or for the bank's peace of mind, so the bank will lend them money or keep lending it.</p><p>Maybe they are worried about being audited, and the audit <strong>SHIFTS THE RISK</strong> from them to the accounting firm. Again, it is all about the hole, not the drill. The better you understand this, the more you will prosper.</p>"}$j$::jsonb, false),

  ('ddddffff-0000-0000-0000-000000000304', 'ddddffff-0000-0000-0000-000000000101',
   'instructions', 3, 'question',
   $j${"prompts":["What is the MAXIMUM POTENTIAL BENEFIT from the use of your product, and what is the MINIMUM BENEFIT?"]}$j$::jsonb, true),

  ('ddddffff-0000-0000-0000-000000000305', 'ddddffff-0000-0000-0000-000000000101',
   'instructions', 4, 'rich_text',
   $j${"html":"<p>Rarely is satisfaction binary, a simple yes or no. Usually there are degrees of satisfaction, and you need to understand these clearly.</p>"}$j$::jsonb, false)
on conflict (id) do update set
  lesson_id     = excluded.lesson_id,
  section       = excluded.section,
  sort_index    = excluded.sort_index,
  block_type    = excluded.block_type,
  data          = excluded.data,
  is_checkpoint = excluded.is_checkpoint;
