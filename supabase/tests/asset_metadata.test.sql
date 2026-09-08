begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select hasnt_column('public', 'template_assets', 'object_path', 'asset paths are derived');
select hasnt_column('public', 'template_assets', 'byte_size', 'Storage owns byte limits');
select results_eq(
  $$select id, file_size_limit::integer, allowed_mime_types from storage.buckets
    where id in ('template-assets', 'published-template-assets') order by id$$,
  $$values ('published-template-assets'::text, 524288, array['image/webp']::text[]),
           ('template-assets'::text, 524288, array['image/webp']::text[])$$,
  'Storage still restricts both buckets to WebP up to 512 KiB'
);

insert into auth.users (id, raw_app_meta_data) values
  ('55555555-5555-4555-8555-555555555555', '{"provider":"google"}'),
  ('66666666-6666-4666-8666-666666666666', '{"provider":"google"}');
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated","app_metadata":{"provider":"google"}}', true);

select lives_ok($$insert into public.template_assets (content_hash, name) values (repeat('a', 64), '아이콘')$$,
  'asset metadata needs only a hash and name');
select throws_ok($$insert into public.template_assets (owner_id, content_hash, name)
  values ('66666666-6666-4666-8666-666666666666', repeat('b', 64), '위조')$$,
  '42501', null, 'asset ownership cannot be forged');
select throws_ok($$insert into public.template_assets (content_hash, name) values ('../invalid', '아이콘')$$,
  '23514', null, 'invalid asset hashes cannot become paths');
insert into public.template_assets (content_hash, name)
select lpad(sequence::text, 64, '0'), '아이콘' from generate_series(1, 99) sequence;
select throws_ok($$insert into public.template_assets (content_hash, name) values (repeat('b', 64), '초과')$$,
  'P0001', 'ASSET_LIMIT_REACHED', 'the 100-asset limit cannot be bypassed');

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","app_metadata":{"provider":"google"}}', true);
select is((select count(*)::integer from public.template_assets), 0,
  'another account cannot list private asset metadata');
select * from finish();
rollback;
