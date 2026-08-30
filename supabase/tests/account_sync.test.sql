begin;

create extension if not exists pgtap with schema extensions;
select plan(36);

select has_table('public', 'templates', 'templates table exists');
select has_table('public', 'template_publications', 'publications table exists');
select has_function(
  'public',
  'browse_publications',
  array['text', 'text', 'integer', 'integer'],
  'anonymous gallery function exists'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'owner@example.test',
    '',
    now(),
    '{"provider":"google","providers":["google"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'other@example.test',
    '',
    now(),
    '{"provider":"google","providers":["google"]}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'password@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now()
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}',
  true
);

select throws_ok(
  $$insert into public.templates (id, document, content_hash)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}'::jsonb, repeat('a', 64))$$,
  '42501',
  null,
  'direct template writes are denied'
);

select throws_ok(
  $$select public.put_template(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '{
      "version": 1,
      "name": "잘못된 높이",
      "height": 1.5,
      "cloned": false,
      "createdAt": "2026-08-31T00:00:00.000Z",
      "updatedAt": "2026-08-31T00:00:00.000Z",
      "items": [],
      "stagingItems": []
    }'::jsonb,
    repeat('c', 64),
    null
  )$$,
  '22023',
  'INVALID_TEMPLATE',
  'template height must be an integer'
);

select lives_ok(
  $$select public.put_template(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '{
      "version": 1,
      "name": "공유 템플릿",
      "height": 2,
      "cloned": false,
      "createdAt": "2026-08-31T00:00:00.000Z",
      "updatedAt": "2026-08-31T00:00:00.000Z",
      "items": [{
        "templateItemId": 1,
        "name": "링쿠",
        "siteUrl": "https://linku.example/",
        "position": {"x": 0, "y": 0},
        "size": {"width": 2, "height": 1},
        "icon": {"kind": "builtin", "key": "link"}
      }],
      "stagingItems": []
    }'::jsonb,
    repeat('a', 64),
    null
  )$$,
  'owner can create a template through the RPC'
);

select is(
  (select count(*)::integer from public.templates),
  1,
  'owner can read the created template'
);

reset role;
insert into public.templates (
  id,
  owner_id,
  document,
  content_hash,
  deleted_at
)
select
  ('10000000-0000-4000-8000-' || lpad(sequence::text, 12, '0'))::uuid,
  '11111111-1111-4111-8111-111111111111'::uuid,
  (select document from public.templates
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  repeat('1', 64),
  now() - make_interval(secs => sequence)
from generate_series(1, 101) sequence;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}',
  true
);

select lives_ok(
  $$select public.put_template(
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    (select document from public.templates
      where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    repeat('d', 64),
    null
  )$$,
  'creating a template prunes old deletion markers'
);

select is(
  (select count(*)::integer from public.templates where deleted_at is not null),
  100,
  'deletion history stays bounded per account'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values (
      'template-assets',
      '11111111-1111-4111-8111-111111111111/' || repeat('d', 64) || '.webp',
      '11111111-1111-4111-8111-111111111111'
    )$$,
  'owner can store a content-addressed private icon'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values (
      'template-assets',
      '11111111-1111-4111-8111-111111111111/nested/' || repeat('d', 64) || '.webp',
      '11111111-1111-4111-8111-111111111111'
    )$$,
  '42501',
  null,
  'private icon paths cannot create nested or arbitrary objects'
);

select lives_ok(
  $$select public.put_template(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    format('{
      "version": 1,
      "name": "아이콘 템플릿",
      "height": 1,
      "cloned": false,
      "createdAt": "2026-08-31T00:00:00.000Z",
      "updatedAt": "2026-08-31T00:00:00.000Z",
      "items": [{
        "templateItemId": 2,
        "name": "링쿠",
        "siteUrl": "https://linku.example/",
        "position": {"x": 0, "y": 0},
        "size": {"width": 2, "height": 1},
        "icon": {"kind": "asset", "hash": "%s", "name": "링쿠 아이콘"}
      }],
      "stagingItems": []
    }', repeat('e', 64))::jsonb,
    repeat('b', 64),
    null
  )$$,
  'owner can create a template that references a private icon'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values (
      'published-template-assets',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/' || repeat('e', 64) || '.webp',
      '11111111-1111-4111-8111-111111111111'
    )$$,
  'owner can publish an icon referenced by the source template'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values (
      'published-template-assets',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/' || repeat('f', 64) || '.webp',
      '11111111-1111-4111-8111-111111111111'
    )$$,
  '42501',
  null,
  'unreferenced files cannot consume public storage'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}',
  true
);

select is(
  (select count(*)::integer from public.templates),
  0,
  'another user cannot read the template'
);

select is(
  (select count(*)::integer from storage.objects),
  0,
  'another user cannot list the owner storage objects'
);

select throws_ok(
  $$select public.put_template(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '{
      "version": 1,
      "name": "탈인 템플릿",
      "height": 1,
      "cloned": false,
      "createdAt": "2026-08-31T00:00:00.000Z",
      "updatedAt": "2026-08-31T00:00:00.000Z",
      "items": [],
      "stagingItems": []
    }'::jsonb,
    repeat('b', 64),
    1
  )$$,
  '40001',
  'LINKU_CONFLICT',
  'another user cannot overwrite a template by id'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}',
  true
);

select lives_ok(
  $$select public.update_nickname('링쿠지기')$$,
  'owner can set a public nickname'
);

select lives_ok(
  $$select public.publish_template('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null)$$,
  'owner can publish a synced template'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*)::integer from public.browse_publications('', 'latest', 0, 12)),
  1,
  'anonymous users can browse active publications'
);

select is(
  (select author_nickname from public.browse_publications('', 'latest', 0, 12)),
  '링쿠지기',
  'gallery returns only the chosen public nickname'
);

select is(
  public.record_publication_clone('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1::bigint,
  'anonymous clone counting is atomic'
);

select throws_ok(
  $$select public.set_publication_liked('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true)$$,
  '42501',
  'LOGIN_REQUIRED',
  'likes require login'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}',
  true
);

select is(
  public.set_publication_liked('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true),
  1::bigint,
  'a logged-in user can like a publication'
);

select is(
  public.set_publication_liked('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true),
  1::bigint,
  'liking twice is idempotent'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","app_metadata":{"provider":"google","providers":["google"]}}',
  true
);

select throws_ok(
  $$select public.delete_template('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1)$$,
  '55000',
  'PUBLICATION_ACTIVE',
  'an actively published source cannot be deleted'
);

select lives_ok(
  $$select public.put_template(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '{
      "version": 1,
      "name": "수정된 템플릿",
      "height": 1,
      "cloned": false,
      "createdAt": "2026-08-31T00:00:00.000Z",
      "updatedAt": "2026-08-31T01:00:00.000Z",
      "items": [],
      "stagingItems": []
    }'::jsonb,
    repeat('c', 64),
    1
  )$$,
  'source can change without mutating its published snapshot'
);

select is(
  (select snapshot ->> 'name' from public.template_publications
    where template_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  '공유 템플릿',
  'publication remains a manual snapshot'
);

select lives_ok(
  $$select public.publish_template('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1)$$,
  'owner can manually update the published snapshot'
);

select results_eq(
  $$select revision, like_count, clone_count
    from public.template_publications
    where template_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  $$values (2::bigint, 1::bigint, 1::bigint)$$,
  'manual update preserves publication identity and counters'
);

select lives_ok(
  $$select public.unpublish_template('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 2)$$,
  'owner can unpublish'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*)::integer from public.browse_publications('', 'latest', 0, 12)),
  0,
  'unpublished templates disappear from the gallery'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);

select throws_ok(
  $$select public.update_nickname('공급자 없는 사용자')$$,
  '42501',
  'GOOGLE_ACCOUNT_REQUIRED',
  'sessions without provider metadata cannot use account RPCs'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{"provider":"email","providers":["email"]}}',
  true
);

select is(
  (select count(*)::integer from public.profiles),
  0,
  'non-Google sessions cannot read even their own profile'
);

select throws_ok(
  $$select public.update_nickname('비밀번호 사용자')$$,
  '42501',
  'GOOGLE_ACCOUNT_REQUIRED',
  'non-Google sessions cannot use account RPCs'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values (
      'template-assets',
      '33333333-3333-4333-8333-333333333333/' || repeat('f', 64) || '.webp',
      '33333333-3333-4333-8333-333333333333'
    )$$,
  '42501',
  null,
  'non-Google sessions cannot write storage objects'
);

select * from finish();
rollback;
