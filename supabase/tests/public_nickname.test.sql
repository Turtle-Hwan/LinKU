begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, raw_app_meta_data) values
  ('44444444-4444-4444-8444-444444444444', '{"provider":"google"}');
select is((select count(*)::integer from public.profiles), 0,
  'Auth signup does not run nickname business logic');
select ok(not has_function_privilege('anon', 'public.initialize_profile(text)', 'execute'),
  'anonymous users cannot initialize profiles');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","app_metadata":{"provider":"google"}}', true);
select is((public.initialize_profile('따뜻한 건구스')).nickname, '따뜻한 건구스',
  'the database stores the name provided by application code');
select is((public.initialize_profile('차가운 건덕이')).nickname, '따뜻한 건구스',
  'a later initializer does not overwrite the first name');
select is((public.update_nickname('나만의 건덕이')).nickname, '나만의 건덕이',
  'the owner can change their nickname');
select is((public.initialize_profile('차가운 건덕이')).nickname, '나만의 건덕이',
  'initialization preserves a user-chosen nickname');
select throws_ok($$select public.update_nickname('')$$, '22023', 'INVALID_NICKNAME',
  'empty nicknames are rejected');
select lives_ok('select public.clear_linku_data()', 'cloud cleanup removes app data');
select is((select count(*)::integer from public.profiles), 0,
  'cleanup removes the profile without generating a name in SQL');
select * from finish();
rollback;
