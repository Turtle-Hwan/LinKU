begin;
create extension if not exists pgtap with schema extensions;
select plan(7);
select hasnt_column('public', 'template_publications', 'author_nickname', 'profiles own nicknames');

insert into auth.users (id, raw_app_meta_data) values
  ('55555555-5555-4555-8555-555555555555', '{"provider":"google"}'),
  ('66666666-6666-4666-8666-666666666666', '{"provider":"google"}');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","app_metadata":{"provider":"google"}}', true);
select public.initialize_profile('따뜻한 건구스');
select public.put_template('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  '{"version":1,"name":"조인 테스트","height":1,"items":[],"stagingItems":[],"cloned":false,
    "createdAt":"2026-09-08T00:00:00Z","updatedAt":"2026-09-08T00:00:00Z"}', repeat('d', 64));
select public.publish_template('dddddddd-dddd-4ddd-8ddd-dddddddddddd', repeat('d', 64));
create temporary table publication_before_rename on commit drop as
select ctid::text as row_location from public.template_publications;
select public.update_nickname('차가운 건덕이');
select is((select ctid::text from public.template_publications),
  (select row_location from publication_before_rename), 'renaming does not rewrite publications');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select author_nickname from public.browse_publications()), '차가운 건덕이',
  'anonymous gallery joins the current public nickname');
select is((select count(*)::integer from public.browse_publications('차가운 건덕이')), 1,
  'search uses the current nickname');
select is((select count(*)::integer from public.browse_publications('따뜻한 건구스')), 0,
  'search does not use the old nickname');
select throws_ok('select * from public.profiles', '42501', null,
  'the join does not expose the profiles table to anonymous callers');

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","app_metadata":{"provider":"google"}}', true);
select is((select count(*)::integer from public.profiles), 0,
  'another account cannot read the joined profile directly');
select * from finish();
rollback;
